#!/usr/bin/env node
// Daily refresh of the Wandura Toolkit data from wandura.ai.
// Plain Node 20, no dependencies, no paid APIs.
//
// What it does:
//  - re-reads every page a price came from; a price is kept only if its quoted
//    sentence is still on the page (or the same sentence with new numbers, in
//    which case the new number is taken from that sentence)
//  - re-reads /pricing (plans, packs, free credits, 1 credit = $X)
//  - looks for new /m/ and /im/ model pages and adds one only if it states a price
//  - re-reads the weekly challenge page (week, theme, genre, rules, deadline)
// Safety: on a failed fetch, too few prices, missing required models or no
// challenge, it leaves the data files untouched and exits 0.
// Usage: node scripts/update.mjs [--dry-run] [--date YYYY-MM-DD]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_JSON = path.join(ROOT, 'site', 'data', 'prices.json');
const DATA_JS = path.join(ROOT, 'site', 'data', 'prices.js');
const BASE = 'https://www.wandura.ai';
const CHALLENGE_URL = BASE + '/contests/film-weekly-challenges';
const UA = 'Mozilla/5.0 (compatible; WanduraToolkit-updater/1.0; +https://github.com/Logtun/wandura-toolkit)';
const MIN_KEEP_RATIO = 0.7;
// The site's presets and the kit's cost estimate use these; never ship data without them.
export const REQUIRED = [
  ['Seedance 2.0', '8s · 720p · 16:9 (default)'],
  ['Kling 3.0', '5s · 16:9 (default)'],
  ['Nano Banana Pro', '1K'],
  ['Nano Banana 2', '1K'],
];

const NUM = /\d+(?:,\d{3})*(?:\.\d+)?/g;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/* ---------------- text helpers ---------------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d', mdash: '\u2014', ndash: '\u2013', hellip: '\u2026', middot: '\u00b7', times: '\u00d7', copy: '\u00a9', rarr: '\u2192', nearr: '\u2197' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) ? String.fromCodePoint(c) : m; }
    const v = ENT[e.toLowerCase()]; return v === undefined ? m : v;
  });
}
export function norm(s) { return String(s).normalize('NFKC').replace(/\s+/g, ' ').trim(); }
export function htmlToLines(html) {
  let h = String(html).replace(/<!--[\s\S]*?-->/g, '');
  h = h.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  h = h.replace(/<[^>]+>/g, '\n');
  return decode(h).split('\n').map(norm).filter(Boolean);
}
export function htmlToText(html) { return norm(htmlToLines(html).join(' ')); }
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toNum = s => Number(String(s).replace(/,/g, ''));

/* ---------------- fetching ---------------- */
async function get(url) {
  let last;
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (r.status === 404 || r.status === 410) return { status: r.status, html: null };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const html = await r.text();
      if (html.length < 500) throw new Error('page too short (' + html.length + ' bytes)');
      return { status: r.status, html };
    } catch (e) { last = e; await new Promise(res => setTimeout(res, 2000 * a)); }
  }
  throw new Error('fetch failed for ' + url + ': ' + (last && last.message));
}

/* ---------------- prices ---------------- */
// Re-check every entry that shares one quote on one page.
// Returns { kept:[entries], dropped:[{entry,reason}], changed:[{entry,from,to}] }
export function refreshGroup(entries, pageText, field, today) {
  const out = { kept: [], dropped: [], changed: [], map: new Map() };
  const q = norm(entries[0].quote);
  if (pageText.includes(q)) { for (const e of entries) { const ne = { ...e, read: today }; out.kept.push(ne); out.map.set(e, ne); } return out; }
  const toks = [...q.matchAll(NUM)];
  const parts = []; let p = 0;
  for (const t of toks) { parts.push(esc(q.slice(p, t.index))); p = t.index + t[0].length; }
  parts.push(esc(q.slice(p)));
  const re = new RegExp(parts.join('(\\d+(?:,\\d{3})*(?:\\.\\d+)?)'), 'g');
  const ms = [...pageText.matchAll(re)];
  if (ms.length !== 1) { for (const e of entries) out.dropped.push({ entry: e, reason: ms.length ? 'quote is ambiguous on the page' : 'quote no longer on the page' }); return out; }
  const nv = ms[0].slice(1);
  const values = new Set(entries.map(e => e[field]));
  const priceIdx = new Set();
  toks.forEach((t, i) => {
    const after = q.slice(t.index + t[0].length);
    if (/^\s*credits?\b/i.test(after) || values.has(toNum(t[0]))) priceIdx.add(i);
  });
  for (let i = 0; i < toks.length; i++) {
    const dollar = q[toks[i].index - 1] === '$';
    if (!priceIdx.has(i) && !dollar && nv[i] !== toks[i][0]) {
      for (const e of entries) out.dropped.push({ entry: e, reason: 'wording changed around the price ("' + toks[i][0] + '" is now "' + nv[i] + '")' });
      return out;
    }
  }
  for (const e of entries) {
    const idx = toks.map((t, i) => i).filter(i => priceIdx.has(i) && toNum(toks[i][0]) === e[field]);
    const nvals = [...new Set(idx.map(i => toNum(nv[i])))];
    if (nvals.length !== 1) { out.dropped.push({ entry: e, reason: 'cannot tell which number is this price' }); continue; }
    const ne = { ...e, quote: ms[0][0], read: today, [field]: nvals[0] };
    out.kept.push(ne); out.map.set(e, ne);
    if (nvals[0] !== e[field]) out.changed.push({ entry: ne, from: e[field], to: nvals[0] });
  }
  return out;
}

export function parsePricing(text, today, src) {
  const plans = [];
  for (const name of ['Basic', 'Growth']) {
    const m = text.match(new RegExp(name + ' \\$(\\d+(?:\\.\\d+)?) /month[^$]{0,120}?(?:\\$\\d+/mo)?[^$]{0,60}?(\\d+(?:,\\d{3})*) credits every month'));
    if (!m) return null;
    plans.push({ name, usd_per_month: toNum(m[1]), credits: toNum(m[2]), type: 'plan', source: src, read: today, quote: m[0] });
  }
  const packs = [];
  const life = text.match(/Pack credits last (\d+) days/);
  const needPlan = /Subscribe to a plan first/.test(text);
  const note = ['One-time top-up', needPlan ? 'needs an active plan' : null, life ? 'pack credits last ' + life[1] + ' days' : null].filter(Boolean).join('; ') + '.';
  for (const m of text.matchAll(/(\d+(?:,\d{3})*)((?: Save \d+%| Best value| Most popular)*) Pack (\w{1,3}) \$(\d+(?:\.\d+)?)/g)) {
    packs.push({ name: 'Pack ' + m[3], usd: toNum(m[4]), credits: toNum(m[1]), type: 'pack', source: src, read: today, note });
  }
  const free = text.match(/Start free with (\d+(?:,\d{3})*) credits\./);
  const cu = text.match(/1 credit = \$(\d+(?:\.\d+)?)/);
  const cov = [...text.matchAll(/Up to (\d+(?:,\d{3})*) videos or (\d+(?:,\d{3})*) Kling 3\.0 Up to (\d+(?:,\d{3})*) images or (\d+(?:,\d{3})*) GPT Image 2/g)];
  if (!free || !cu || cov.length < 2) return null;
  const upTo = /"Up to" uses 5-second videos and our lowest-cost models\./.test(text) ? ' "Up to" uses 5-second videos and our lowest-cost models.' : '';
  const cq = (n, m) => n + ': "Up to ' + m[1] + ' videos or ' + m[2] + ' Kling 3.0 · Up to ' + m[3] + ' images or ' + m[4] + ' GPT Image 2".';
  return {
    plans, packs,
    free: { name: 'Free start', credits: toNum(free[1]), type: 'free', source: src, read: today, quote: free[0] },
    credit_usd: toNum(cu[1]),
    plan_coverage_stated: {
      Basic: { kling30: toNum(cov[0][2]), gptimage2: toNum(cov[0][4]) },
      Growth: { kling30: toNum(cov[1][2]), gptimage2: toNum(cov[1][4]) },
      quote: cq('Basic', cov[0]) + ' ' + cq('Growth', cov[1]) + upTo,
      source: src,
    },
  };
}

// A new model page joins the planner only if it states a credit price in a clear sentence
// and that sentence does not name a model the data already has.
export function priceFromNewPage(html, url, knownModels, today) {
  const text = htmlToText(html);
  const h1 = (String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  let name = h1 ? norm(decode(h1.replace(/<[^>]+>/g, ' '))) : '';
  name = name.replace(/\s*[:|\u2013\u2014-].*$/, '').replace(/\s+(?:AI\s+)?(?:Video|Image|Photo|Voice|Music|Audio)\s+(?:Generator|Maker|Editor).*$/i, '').replace(/\s+(?:online|free)$/i, '').trim();
  if (!name || name.length > 40) return { skip: 'no clear model name on the page' };
  if (knownModels.includes(name)) return { skip: 'model "' + name + '" is already in the data' };
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  for (const s of sentences) {
    if (/1 credit =|free credits|credits? on signup/i.test(s)) continue;
    const m = s.match(/\b(?:costs?|for|is|at) (\d+(?:,\d{3})*(?:\.\d+)?) credits?\b/);
    if (!m || !/\b(?:default|costs?)\b/i.test(s)) continue;
    if (!s.includes(name)) continue; // the sentence must name this page's model
    if (knownModels.some(k => k !== name && s.includes(k))) return { skip: 'price sentence names a model already in the data: "' + s.slice(0, 120) + '"' };
    const video = /\/m\//.test(url);
    const sec = s.match(/(\d+)[- ]second/);
    const e = { model: name, group: name, setting: (video && sec ? sec[1] + 's · ' : '') + 'default', credits: toNum(m[1]), kind: video ? 'video' : 'image', source: url, read: today, quote: s, added_by: 'daily update' };
    if (video && sec) e.seconds = Number(sec[1]);
    return { entry: e };
  }
  return { skip: 'no credit price stated' };
}

/* ---------------- weekly challenge ---------------- */
function cap(s) { return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase()); }
function after(lines, pred, n = 1) { const i = lines.findIndex(pred); return i < 0 ? null : lines.slice(i + 1, i + 1 + n); }
export function parseChallenge(html, today, prevYear) {
  const lines = htmlToLines(html);
  const text = norm(lines.join(' '));
  const c = { source: CHALLENGE_URL, read: today };
  // "WEEK 02" then "HORROR · THE KNOCK" then "OPEN NOW"
  const wi = lines.findIndex(l => /^WEEK \d{1,3}$/.test(l));
  if (wi < 0) return null;
  c.week = 'Week ' + lines[wi].split(' ')[1];
  const gt = (lines[wi + 1] || '').match(/^([A-Z][A-Z\- ]+?) · (.+)$/);
  if (!gt) return null;
  c.genre = cap(gt[1]).replace(/^Sci-Fi$/, 'Sci-fi');
  const status = lines[wi + 2] && /^[A-Z ]{3,20}$/.test(lines[wi + 2]) ? cap(lines[wi + 2]).replace(/ (\w)/g, (m, a) => ' ' + a.toLowerCase()) : null;
  // the brief block: "01 / THIS WEEK'S BRIEF" / "The Knock." / tagline line 2 / "Horror · Week 02" / brief / pillars... / "View the brief"
  const bi = lines.findIndex(l => /^\d+ \/ THIS WEEK.S BRIEF$/i.test(l));
  if (bi < 0) return null;
  c.theme = lines[bi + 1].replace(/\.$/, '');
  if (norm(c.theme).toUpperCase() !== norm(gt[2]).toUpperCase()) return null;
  const gw = lines.findIndex((l, i) => i > bi && /· Week \d+$/.test(l));
  if (gw < 0) return null;
  // tagline: hero lines between the big title and "Create a ..." (sentence-case lines only)
  const ci = lines.findIndex((l, i) => i > wi && /^Create a /.test(l));
  const hero = ci > 0 ? lines.slice(wi + 3, ci).filter(l => /[a-z]/.test(l) && /[.!?]$/.test(l)) : [];
  c.tagline = hero.length ? hero.join(' ') : lines.slice(bi + 1, gw).join(' ');
  c.brief = lines[gw + 1];
  const vb = lines.findIndex((l, i) => i > gw && /^View the brief$/i.test(l));
  c.pillars = vb > 0 ? lines.slice(gw + 2, vb) : [];
  c.beats = [];
  if (vb > 0) {
    for (let i = vb + 1; i + 2 < lines.length && /^\d{2}$/.test(lines[i]); i += 3) c.beats.push([lines[i + 1], lines[i + 2]]);
  }
  // deadline: the first "10 Nov 2026 · 23:59 UTC" after "Film submissions close in"
  const dl = text.match(/Film submissions close in[\s\S]{0,200}?(\d{1,2}) ([A-Z][a-z]{2}) (\d{4}) · (\d{1,2}):(\d{2}) UTC/);
  if (!dl) return null;
  const year = Number(dl[3]);
  c.deadline = dl[1] + ' ' + dl[2] + ' ' + dl[3] + ' · ' + dl[4].padStart(2, '0') + ':' + dl[5] + ' UTC (film submissions close)';
  const mon = MONTHS[dl[2].toLowerCase()];
  if (mon === undefined) return null;
  c.deadline_iso = new Date(Date.UTC(year, mon, Number(dl[1]), Number(dl[4]), Number(dl[5]), 59)).toISOString();
  if (status) c.status = status;
  const ideas = text.match(/Send your idea by (\d{1,2} [A-Z][a-z]{2}), (\d{1,2}:\d{2}) UTC/);
  if (ideas) c.ideas_close = ideas[1] + ' ' + year + ', ' + ideas[2] + ' UTC';
  const vl = text.match(/Viral numbers lock on (\d{1,2} [A-Z][a-z]{2} \d{4}) at (\d{1,2}:\d{2}(?::\d{2})?) UTC/);
  if (vl) c.viral_lock = vl[1] + ', ' + vl[2] + ' UTC';
  const res = text.match(/Results on (\d{1,2} [A-Z][a-z]{2})(?: (\d{4}))? \(UTC\)/);
  if (res) c.results = res[1] + ' ' + (res[2] || year) + ' (UTC)';
  // rules, each only from facts stated on the page
  const rules = [];
  const len = text.match(/(\d{2})[-\u2013](\d{2}) seconds/i);
  const tgt = text.match(/Target (\d{2}) seconds(, including opening and end card)?/);
  if (len) { c.length = { min: +len[1], max: +len[2], target: tgt ? +tgt[1] : Math.round((+len[1] + +len[2]) / 2) }; rules.push(len[1] + '\u2013' + len[2] + ' seconds' + (tgt ? '; target ' + tgt[1] + ' s' + (tgt[2] ? ' including opening and end card' : '') : '')); }
  const fmt = text.match(/(\d{1,2}:\d{1,2}) film made with ([A-Z][\w.]*(?: [\w.]+){0,4}?) in Cinema Studio, native (\d{3,4}p)/);
  const asp = fmt ? fmt[1] : (text.match(/\b(9:16|16:9|1:1|4:5)\b/) || [])[1];
  const resol = fmt ? fmt[3] : (text.match(/native (\d{3,4}p)/) || [])[1];
  if (asp) c.aspect = asp; if (resol) c.resolution = resol;
  if (asp || resol) rules.push([asp ? asp + (asp === '9:16' ? ' vertical' : '') : null, resol ? 'native ' + resol : null].filter(Boolean).join(', '));
  const model = fmt ? fmt[2] : (text.match(/Generate with ([A-Z][\w.]*(?: [\w.]+){0,4}?)\./) || [])[1];
  const gen = text.match(/Each generation is up to (\d+) seconds/);
  if (model) { c.model = model; rules.push('Made with ' + model + (/in Cinema Studio/.test(text) ? ' in Cinema Studio' : '') + (gen ? '; each generation up to ' + gen[1] + ' s' : '')); }
  if (/Made with Wandura\.ai watermark/.test(text)) rules.push('Edit and export in Wandura AI Edits with the official "Made with Wandura.ai" watermark visible throughout');
  if (/fictional characters/i.test(text) && /no real-person images/i.test(text)) rules.push('Fictional characters and AI voices only; no real-person images or cloned real voices');
  if (/Use media you have rights to share/.test(text)) rules.push('Use media you have rights to share');
  const tags = [...new Set(text.match(/#[A-Za-z]\w+/g) || [])];
  if (/TikTok/.test(text)) rules.push('Post publicly on TikTok' + (/AI label/.test(text) ? ' with the AI label' : '') + (tags.length ? ' and ' + tags.join(' ') : ''));
  const age = text.match(/Creators aged (\d+)\+/); const team = text.match(/team of up to (\d+)/i);
  if (/Submit your link|TikTok link/.test(text)) rules.push('Submit the TikTok link from your registered account' + ((age || team) ? ' (' + [age ? age[1] + '+' : null, team ? 'solo or team of up to ' + team[1] : null, /one film per week/i.test(text) ? 'one film per week' : null].filter(Boolean).join(', ') + ')' : ''));
  if (/No fake engagement/.test(text)) rules.push('No fake engagement');
  c.rules = rules;
  if (!c.theme || !c.brief || !c.week || rules.length < 3) return null;
  return c;
}

// Same words the site shows; also used by site/challenge-note.js.
export function statusNote(c, nowMs) {
  if (!c || !c.deadline_iso) return c && c.status_note || '';
  if (nowMs <= Date.parse(c.deadline_iso)) return '';
  const short = c.deadline.replace(/ \(film submissions close\)$/, '').replace(/^(\d{1,2} [A-Z][a-z]{2}) \d{4} · /, '$1 ');
  const p = c.read.split('-'); const rd = (+p[2]) + ' ' + Object.keys(MONTHS)[+p[1] - 1].replace(/^./, x => x.toUpperCase()) + ' ' + p[0];
  if (c.status && /open/i.test(c.status)) return 'The page still shows "' + c.status + '", but the ' + short + ' film deadline it lists has passed (read ' + rd + ').';
  return 'Film submissions for ' + c.week + ' closed ' + short + ' (read ' + rd + ').';
}

/* ---------------- main ---------------- */
function keyOf(e) { return e.source + '\u0000' + e.quote; }
export async function update({ today, dryRun = false, log = console.log } = {}) {
  const old = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
  const oldCount = old.video.length + old.image.length + old.audio.length;
  const report = { today, aborted: null, changed: [], dropped: [], added: [], notes: [] };
  const abort = why => { report.aborted = why; return report; };

  const lists = { video: old.video, image: old.image, audio: old.audio, per_second_rates: old.per_second_rates };
  const urls = new Set([BASE + '/pricing', CHALLENGE_URL, BASE + '/']);
  for (const l of Object.values(lists)) for (const e of l) urls.add(e.source);
  for (const u of old.unpublished || []) urls.add(u.source);
  const pages = {};
  try {
    const all = [...urls];
    for (let i = 0; i < all.length; i += 6) {
      const got = await Promise.all(all.slice(i, i + 6).map(u => get(u)));
      got.forEach((g, j) => { pages[all[i + j]] = g; });
    }
  } catch (e) { return abort(e.message); }
  for (const u of [BASE + '/pricing', CHALLENGE_URL]) if (!pages[u].html) return abort(u + ' answered ' + pages[u].status);
  const text = {};
  for (const [u, g] of Object.entries(pages)) text[u] = g.html ? htmlToText(g.html) : null;

  // prices
  const next = {};
  for (const [k, l] of Object.entries(lists)) {
    const field = k === 'per_second_rates' ? 'credits_per_second' : 'credits';
    const groups = new Map();
    l.forEach(e => { const g = groups.get(keyOf(e)) || []; g.push(e); groups.set(keyOf(e), g); });
    const map = new Map();
    for (const g of groups.values()) {
      const t = text[g[0].source];
      if (t === null) { g.forEach(e => report.dropped.push({ model: e.model, setting: e.setting, source: e.source, reason: 'page is gone (' + pages[g[0].source].status + ')' })); continue; }
      const r = refreshGroup(g, t, field, today);
      r.dropped.forEach(d => report.dropped.push({ model: d.entry.model, setting: d.entry.setting, source: d.entry.source, reason: d.reason }));
      r.changed.forEach(c => report.changed.push({ model: c.entry.model, setting: c.entry.setting, from: c.from, to: c.to, source: c.entry.source }));
      for (const [a, b] of r.map) map.set(a, b);
    }
    next[k] = l.filter(e => map.has(e)).map(e => map.get(e)); // original order
  }

  // new model pages
  const known = new Set();
  for (const l of Object.values(lists)) for (const e of l) known.add(e.source);
  for (const u of old.unpublished || []) known.add(u.source);
  const found = new Set();
  for (const g of Object.values(pages)) if (g.html) for (const m of g.html.matchAll(/href="(?:https:\/\/www\.wandura\.ai)?(\/(?:m|im)\/[a-z0-9-]+)\/?"/g)) found.add(BASE + m[1]);
  const fresh = [...found].filter(u => !known.has(u)).sort().slice(0, 40);
  const knownModels = [...new Set([...next.video, ...next.image, ...next.audio].map(e => e.group).concat((old.unpublished || []).map(u => u.model)))].sort((a, b) => b.length - a.length);
  for (const u of fresh) {
    let g; try { g = await get(u); } catch (e) { return abort(e.message); }
    if (!g.html) continue;
    const r = priceFromNewPage(g.html, u, knownModels, today);
    if (r.entry) { next[r.entry.kind].push(r.entry); report.added.push(r.entry); knownModels.push(r.entry.group); }
    else report.notes.push(u + ': not added, ' + r.skip);
  }

  const newCount = next.video.length + next.image.length + next.audio.length;
  if (newCount < MIN_KEEP_RATIO * oldCount) return abort('only ' + newCount + ' of ' + oldCount + ' prices could be confirmed');
  for (const [m, s] of REQUIRED) if (!next.video.concat(next.image).some(e => e.group === m && e.setting === s)) return abort('required price missing: ' + m + ' ' + s);
  if (!next.video.some(e => e.model === 'Seedance 2.0' && e.seconds === 8)) return abort('Seedance 2.0 8s price missing');

  const pr = parsePricing(text[BASE + '/pricing'], today, BASE + '/pricing');
  if (!pr) return abort('could not read plans from /pricing');
  if (!pr.packs.length) report.notes.push('no credit packs found on /pricing');

  // unpublished: keep while the page is there; flag if a price now shows up
  const unpublished = [];
  for (const u of old.unpublished || []) {
    const t = text[u.source];
    if (t === null) { report.notes.push(u.model + ': page gone, dropped from the "price shown on Generate" list'); continue; }
    unpublished.push({ ...u, read: today });
    const m = t.match(new RegExp(esc(u.model) + '\\b(?! Lite| Fast| Mini| Pro| Max)[^.]{0,60}?\\d+(?:,\\d{3})* credits'));
    if (m) report.notes.push(u.model + ' may now have a price on ' + u.source + ' ("' + m[0] + '"); check by hand');
  }

  const ch = parseChallenge(pages[CHALLENGE_URL].html, today);
  if (!ch) return abort('could not read the weekly challenge');
  ch.cinema_controls = old.challenge.cinema_controls; // Cinema Studio options; not on the challenge page
  ch.status_note = statusNote(ch, Date.now());
  if (ch.week !== old.challenge.week) report.notes.push('new challenge: ' + ch.week + ' "' + ch.theme + '" (' + ch.genre + ')');
  if (ch.model && ch.model !== old.challenge.model && !(old.challenge.model === undefined && ch.model === 'Seedance 2.0 Fast')) report.notes.push('challenge model is now ' + ch.model);

  const cuq = text[BASE + '/pricing'].includes(norm(old.credit_usd_quote || '\u0000')) ? old.credit_usd_quote : (text[BASE + '/pricing'].match(/1 credit = \$[^.]*\.\d+[^.]*\./) || [''])[0];
  const data = {
    read: today, site: BASE, credit_usd: pr.credit_usd, credit_usd_quote: cuq,
    plans: pr.plans, packs: pr.packs, free: pr.free, plan_coverage_stated: pr.plan_coverage_stated,
    video: next.video, image: next.image, audio: next.audio, per_second_rates: next.per_second_rates,
    unpublished, challenge: ch,
  };
  report.count = { before: oldCount, after: newCount };
  report.data = data;
  const json = JSON.stringify(data, null, 1) + '\n';
  const js = 'window.WTK_DATA=' + JSON.stringify(data) + ';\n';
  if (!dryRun) {
    const tj = DATA_JSON + '.tmp', tjs = DATA_JS + '.tmp';
    fs.writeFileSync(tj, json); fs.writeFileSync(tjs, js);
    if (!fs.statSync(tj).size || !fs.statSync(tjs).size) { fs.rmSync(tj, { force: true }); fs.rmSync(tjs, { force: true }); return abort('empty write'); }
    fs.renameSync(tj, DATA_JSON); fs.renameSync(tjs, DATA_JS);
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const di = args.indexOf('--date');
  const today = di >= 0 ? args[di + 1] : new Date().toISOString().slice(0, 10);
  const report = await update({ today, dryRun: args.includes('--dry-run') });
  const lines = [];
  if (report.aborted) lines.push('KEPT OLD DATA: ' + report.aborted);
  else {
    lines.push('Read ' + today + ': ' + report.count.after + ' prices (was ' + report.count.before + '), challenge ' + report.data.challenge.week + ' "' + report.data.challenge.theme + '".');
    for (const c of report.changed) lines.push('PRICE CHANGED: ' + c.model + ' ' + c.setting + ': ' + c.from + ' -> ' + c.to + ' (' + c.source + ')');
    for (const a of report.added) lines.push('ADDED: ' + a.model + ' ' + a.setting + ' = ' + a.credits + ' credits (' + a.source + ')');
    for (const d of report.dropped) lines.push('DROPPED: ' + d.model + ' ' + d.setting + ': ' + d.reason + ' (' + d.source + ')');
  }
  for (const n of report.notes) lines.push('NOTE: ' + n);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Wandura data refresh\n\n' + lines.map(l => '- ' + l).join('\n') + '\n');
  process.exitCode = 0; // never fail the job on a bad read; old data stays
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.log('KEPT OLD DATA: ' + e.message); process.exitCode = 0; });
