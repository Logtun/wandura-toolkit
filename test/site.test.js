const test=require('node:test');const assert=require('node:assert');const fs=require('fs');const path=require('path');const vm=require('vm');
const S=path.join(__dirname,'..','site');
const html=fs.readFileSync(path.join(S,'index.html'),'utf8');
test('page basics',()=>{
  assert.match(html,/<title>Wandura Toolkit[^<]+<\/title>/);
  assert.match(html,/name="viewport" content="width=device-width, initial-scale=1/);
  assert.match(html,/Credit Planner/);assert.match(html,/Challenge Kit/);
  assert.match(html,/href="https:\/\/x.com\/iamlogtun"[^>]*>@iamlogtun<\/a><\/p>/);
  assert.match(html,/id="copyAll"/);assert.match(html,/id="themeBtn"/);
  for(const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)){assert.ok(fs.existsSync(path.join(S,m[1])),'missing asset '+m[1]);}
  assert.doesNotMatch(html,/TODO|lorem|\{\{|undefined/i);
});
test('no emoji in shipped text',()=>{
  for(const f of ['index.html','script.js','styles.css']){const t=fs.readFileSync(path.join(S,f),'utf8');assert.doesNotMatch(t,/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,f);}
});
test('prices are scraped, sourced and dated',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(S,'data','prices.json'),'utf8'));
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(S,'data','prices.js'),'utf8'),ctx);
  assert.deepStrictEqual(ctx.window.WTK_DATA.video.length,d.video.length);
  const b=d.plans.find(p=>p.name==='Basic'),g=d.plans.find(p=>p.name==='Growth');
  assert.equal(b.usd_per_month,15);assert.equal(b.credits,1500);assert.equal(g.usd_per_month,49);assert.equal(g.credits,6000);
  const all=[...d.video,...d.image,...d.audio];assert.ok(all.length>50);
  for(const e of all){assert.match(e.source,/^https:\/\/www\.wandura\.ai\//);assert.match(e.read,/^\d{4}-\d{2}-\d{2}$/);assert.ok(e.quote.replace(/,/g,'').includes(String(e.credits)),e.model+' '+e.setting);}
  const sd=d.video.find(e=>e.model==='Seedance 2.0'&&e.seconds===8);assert.equal(sd.credits,208);
  assert.ok(d.unpublished.some(u=>u.model==='Seedance 2.0 Fast'));
  assert.ok(!all.some(e=>e.model==='Seedance 2.0 Fast'),'Fast must not have an invented price');
});
test('challenge brief and studio controls',()=>{
  const d=JSON.parse(fs.readFileSync(path.join(S,'data','prices.json'),'utf8'));const c=d.challenge;
  assert.equal(c.theme,'The Knock');assert.equal(c.week,'Week 02');assert.match(c.deadline,/10 Nov 2026/);
  const js=fs.readFileSync(path.join(S,'script.js'),'utf8');
  const labels=k=>c.cinema_controls[k].options.map(o=>o.label);
  const checks={camerabody:/body:"([^"]+)"/g,lens:/lens:"([^"]+)"/g,era:/era:"([^"]+)"/g,moveset:/move:"([^"]+)"/g,focal:/focal:"([^"]+)"/g,aperture:/ap:"([^"]+)"/g,tempo:/tempo:"([^"]+)"/g,lighting:/light:"([^"]+)"/g,genre:/studio:"([^"]+)"/g};
  for(const [k,re] of Object.entries(checks)){const L=labels(k);let n=0;for(const m of js.matchAll(re)){n++;assert.ok(L.includes(m[1]),k+': '+m[1]+' not a Cinema Studio option');}assert.ok(n>=4,k);}
  for(const g of ['horror','drama','scifi','comedy'])assert.match(js,new RegExp('\\b'+g+':\\{label'));
});
