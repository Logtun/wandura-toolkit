const test=require('node:test');const assert=require('node:assert');const path=require('path');
const F=require(path.join(__dirname,'..','site','features.js'));

test('share state: encode/decode round trip, base64url, unicode',()=>{
  const p={v:1,t:'p',p:'basic',b:1500,k:2000,s:[['Seedance 2.0','8s · 720p · 16:9 (default)',4],['Nano Banana Pro','1K',3]]};
  const e=F.encodeState(p);assert.match(e,/^[A-Za-z0-9_-]+$/);assert.deepStrictEqual(F.decodeState(e),p);
  const k={v:1,t:'k',g:'horror',ti:'The Knock – “night”',l:'Mara',r:30,m:'Seedance 2.0 Fast',br:'Week 03 · Horror\nRules: 25–35 s'};
  assert.deepStrictEqual(F.decodeState(F.encodeState(k)),k);
  const h=F.shareHash(k);assert.equal(h.droppedBrief,false);assert.ok(h.hash.startsWith('#k='));assert.deepStrictEqual(F.readHash(h.hash),k);
  assert.deepStrictEqual(F.readHash(F.shareHash(p).hash),p);
});
test('share state: long brief is dropped, fields kept; junk is rejected',()=>{
  const k={v:1,t:'k',g:'drama',ti:'Long',l:'Ada',r:30,m:'Seedance 2.0 Fast',br:'x'.repeat(3000)};
  const h=F.shareHash(k);assert.equal(h.droppedBrief,true);assert.ok(h.hash.length<=F.MAX_HASH);
  const back=F.readHash(h.hash);assert.equal(back.br,undefined);assert.equal(back.l,'Ada');assert.equal(back.ti,'Long');
  for(const bad of ['','#kit','#planner','#p=!!!','#p=bm90IGpzb24','#k='+F.encodeState({t:'p'}),'#p='+F.encodeState({t:'x'})])assert.equal(F.readHash(bad),null,bad);
});
test('countdown formatting',()=>{
  const M=60000,H=60*M,D=24*H;
  assert.equal(F.formatCountdown(2*D+4*H+12*M+30000),'2d 4h 12m');
  assert.equal(F.formatCountdown(3*H),'3h 0m');
  assert.equal(F.formatCountdown(5*M+7000),'5m 7s');
  assert.equal(F.formatCountdown(59000),'0m 59s');
  assert.equal(F.formatCountdown(0),'Closed');assert.equal(F.formatCountdown(-5),'Closed');
  const iso='2026-11-10T23:59:59.000Z',t=Date.parse(iso);
  assert.deepStrictEqual(F.countdown(iso,t-(1*D+1*H+1*M)),{closed:false,ms:D+H+M,text:'1d 1h 1m'});
  assert.equal(F.countdown(iso,t+1).closed,true);assert.equal(F.countdown(iso,t+1).text,'Closed');
  assert.equal(F.countdown(null,t),null);assert.equal(F.countdown('not a date',t),null);
});
test('compare math: per second, $ cost, clips, highlights',()=>{
  const r=F.compare([
    {name:'Seedance 2.0',setting:'8s',credits:208,seconds:8,resolution:'720p'},
    {name:'Kling 3.0',setting:'5s',credits:65,seconds:5,resolution:null},
    {name:'Seedance 2.0 Fast',setting:'',credits:null}],1500,0.01);
  assert.equal(r.rows[0].perSec,26);assert.equal(r.rows[0].usd,2.08);assert.equal(r.rows[0].clips,7);
  assert.equal(r.rows[1].perSec,13);assert.equal(r.rows[1].usd,0.65);assert.equal(r.rows[1].clips,23);
  assert.ok(Math.abs(r.rows[1].usdPerSec-0.13)<1e-9);
  assert.equal(r.rows[2].priced,false);assert.equal(r.rows[2].clips,null);assert.equal(r.rows[2].usd,null);
  assert.deepStrictEqual(r.cheapestPerSec,[1]);assert.deepStrictEqual(r.mostClips,[1]);
});
test('compare math: ties, images, zero balance, single priced model',()=>{
  const img=F.compare([{name:'A',credits:18},{name:'B',credits:11},{name:'C',credits:6}],100,0.01);
  assert.deepStrictEqual(img.cheapestPerSec,[]);assert.deepStrictEqual(img.mostClips,[2]);assert.equal(img.rows[2].clips,16);
  const tie=F.compare([{name:'A',credits:65,seconds:5},{name:'B',credits:130,seconds:10},{name:'C',credits:208,seconds:8}],1000,0.01);
  assert.deepStrictEqual(tie.cheapestPerSec,[0,1]);
  assert.deepStrictEqual(F.compare([{name:'A',credits:65,seconds:5},{name:'B',credits:130,seconds:5}],0,0.01).mostClips,[]);
  assert.deepStrictEqual(F.compare([{name:'A',credits:65,seconds:5},{name:'X',credits:null}],500,0.01).cheapestPerSec,[]);
});
