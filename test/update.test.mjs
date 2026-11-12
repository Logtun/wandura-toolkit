// Tests for the daily updater (scripts/update.mjs) and the in-browser deadline note.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { refreshGroup, parseChallenge, parsePricing, statusNote, priceFromNewPage, htmlToText, norm } from '../scripts/update.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FX = n => fs.readFileSync(path.join(DIR, 'fixtures', n), 'utf8');
const browser = (() => { const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(DIR, '..', 'site', 'challenge-note.js'), 'utf8'), ctx); return ctx.window; })();

const Q = 'A 5-second Pika 2.2 clip costs 34 credits at 720p (about $0.34) and 76 credits at 1080p (about $0.76).';
const E = [
  { model: 'Pika 2.2', setting: '5s · 720p', credits: 34, quote: Q, source: 'x', read: '2026-11-12' },
  { model: 'Pika 2.2', setting: '5s · 1080p', credits: 76, quote: Q, source: 'x', read: '2026-11-12' },
];

test('price kept when the sentence is still on the page', () => {
  const r = refreshGroup(E, 'Intro. ' + Q + ' More.', 'credits', '2026-11-13');
  assert.equal(r.kept.length, 2); assert.equal(r.kept[0].credits, 34); assert.equal(r.kept[1].read, '2026-11-13'); assert.equal(r.changed.length, 0);
});
test('new price taken from the same sentence when Wandura changes a number', () => {
  const page = Q.replace('34 credits', '40 credits').replace('$0.34', '$0.40');
  const r = refreshGroup(E, page, 'credits', '2026-11-13');
  assert.equal(r.kept.length, 2); assert.equal(r.kept[0].credits, 40); assert.equal(r.kept[1].credits, 76);
  assert.ok(r.kept[0].quote.includes('40 credits')); assert.deepStrictEqual(r.changed.map(c => [c.from, c.to]), [[34, 40]]);
});
test('price dropped, never guessed, when the wording changes or the sentence is gone', () => {
  assert.equal(refreshGroup(E, Q.replace('5-second', '6-second'), 'credits', 'd').kept.length, 0);
  assert.equal(refreshGroup(E, 'Nothing about Pika here.', 'credits', 'd').dropped.length, 2);
  assert.equal(refreshGroup(E, Q.replace('34 credits', '36 credits') + ' ' + Q.replace('34 credits', '35 credits'), 'credits', 'd').kept.length, 0, 'ambiguous page');
});

test('pricing page parse matches the 12 Nov 2026 read', () => {
  const p = parsePricing(norm(FX('pricing-2026-11-12.txt')), '2026-11-12', 'https://www.wandura.ai/pricing');
  assert.deepStrictEqual(p.plans.map(x => [x.name, x.usd_per_month, x.credits]), [['Basic', 15, 1500], ['Growth', 49, 6000]]);
  assert.deepStrictEqual(p.packs.map(x => [x.name, x.usd, x.credits]), [['Pack S', 10, 1000], ['Pack M', 50, 6250], ['Pack L', 100, 14000]]);
  assert.equal(p.free.credits, 160); assert.equal(p.credit_usd, 0.01);
  assert.deepStrictEqual(p.plan_coverage_stated.Growth, { kling30: 92, gptimage2: 193 });
  assert.equal(parsePricing('Pricing coming soon.', 'd', 'u'), null);
});

test('weekly challenge parse matches the 12 Nov 2026 read (Week 02, The Knock)', () => {
  const c = parseChallenge(FX('weekly-challenge-2026-11-12.html'), '2026-11-12');
  assert.equal(c.week, 'Week 02'); assert.equal(c.theme, 'The Knock'); assert.equal(c.genre, 'Horror');
  assert.equal(c.tagline, 'Three knocks. No one should be there.');
  assert.equal(c.deadline, '10 Nov 2026 · 23:59 UTC (film submissions close)');
  assert.equal(c.ideas_close, '7 Nov 2026, 23:59 UTC'); assert.equal(c.viral_lock, '16 Nov 2026, 23:59:59 UTC'); assert.equal(c.results, '17 Nov 2026 (UTC)');
  assert.equal(c.beats.length, 3); assert.equal(c.pillars.length, 3); assert.equal(c.model, 'Seedance 2.0 Fast');
  assert.deepStrictEqual(c.length, { min: 25, max: 35, target: 30 }); assert.equal(c.aspect, '9:16'); assert.equal(c.resolution, '720p');
  assert.ok(c.rules.some(r => r.includes('#WanduraHorror'))); assert.equal(c.rules.length, 9);
  assert.equal(parseChallenge('<html><body>' + 'x'.repeat(600) + '</body></html>', 'd'), null, 'no challenge on the page');
});

function week03() {
  return FX('weekly-challenge-2026-11-12.html')
    .replace(/WEEK 02/g, 'WEEK 03').replace(/Week 02/g, 'Week 03').replace(/HORROR · THE KNOCK/g, 'SCI-FI · BEYOND')
    .replace(/Horror · Week 03/g, 'Sci-fi · Week 03').replace(/The Knock\./g, 'Beyond.').replace(/10 Nov 2026/g, '17 Nov 2026');
}
test('a new week parses, and the deadline note follows its own deadline', () => {
  const c = parseChallenge(week03(), '2026-11-13');
  assert.equal(c.week, 'Week 03'); assert.equal(c.theme, 'Beyond'); assert.equal(c.genre, 'Sci-fi');
  assert.equal(c.deadline_iso, '2026-11-17T23:59:59.000Z');
  assert.equal(browser.WTK_genreKey(c.genre), 'scifi');
  assert.equal(statusNote(c, Date.parse('2026-11-14T10:00:00Z')), '', 'no note before the deadline');
  assert.equal(browser.WTK_statusNote(c, Date.parse('2026-11-14T10:00:00Z')), '');
  const late = Date.parse('2026-11-18T08:00:00Z');
  assert.equal(statusNote(c, late), 'The page still shows "Open now", but the 17 Nov 23:59 UTC film deadline it lists has passed (read 13 Nov 2026).');
  assert.equal(browser.WTK_statusNote(c, late), statusNote(c, late));
  assert.equal(browser.WTK_statusNote({ ...c, status: 'Closed' }, late), 'Film submissions for Week 03 closed 17 Nov 23:59 UTC (read 13 Nov 2026).');
});

test('Week 02 note is the same words the site showed on 12 Nov', () => {
  const c = parseChallenge(FX('weekly-challenge-2026-11-12.html'), '2026-11-12');
  const want = 'The page still shows "Open now", but the 10 Nov 23:59 UTC film deadline it lists has passed (read 12 Nov 2026).';
  assert.equal(statusNote(c, Date.parse('2026-11-12T09:00:00Z')), want);
  assert.equal(browser.WTK_statusNote(c, Date.parse('2026-11-12T09:00:00Z')), want);
  assert.equal(browser.WTK_statusNote({ status_note: 'old' }, 0), 'old', 'old data without deadline_iso still works');
});

test('a new model page joins only with a stated price for a new model', () => {
  const page = '<html><body><h1>Nova 1.0 AI Video Generator</h1><p>A 5-second Nova 1.0 clip costs 50 credits (about $0.50).</p>' + 'x'.repeat(600) + '</body></html>';
  const r = priceFromNewPage(page, 'https://www.wandura.ai/m/nova', ['Kling 3.0'], '2026-11-13');
  assert.equal(r.entry.model, 'Nova 1.0'); assert.equal(r.entry.credits, 50); assert.equal(r.entry.seconds, 5); assert.equal(r.entry.kind, 'video');
  assert.ok(priceFromNewPage(page.replace('costs 50 credits', 'is priced on Generate'), 'https://www.wandura.ai/m/nova', [], 'd').skip);
  assert.ok(priceFromNewPage(page.replace('Nova 1.0 clip', 'Kling 3.0 clip'), 'https://www.wandura.ai/m/nova', ['Kling 3.0'], 'd').skip);
  assert.ok(priceFromNewPage(page, 'https://www.wandura.ai/m/nova', ['Nova 1.0'], 'd').skip, 'already known');
});

test('html to text', () => {
  assert.equal(htmlToText('<p>Costs <b>208</b> credits<!-- --> (about&nbsp;$2.08) &amp; more</p><script>var x="no"</script>'), 'Costs 208 credits (about $2.08) & more');
});
