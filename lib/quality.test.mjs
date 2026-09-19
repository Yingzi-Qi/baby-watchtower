import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityChecks} from './quality.mjs';
const now=Date.parse('2026-09-19T10:00:00Z');
const row={venue:'nado',scenario:'single',order_type:'post_only',batch_size:1};
const sample=(i,v=10000000)=>({...row,ok:true,plot_at:new Date(now-i*60000).toISOString(),confirm_ns:v});
const summary={...row,count:100,ok:99,failed:1,p50_ms:10,p95_ms:20};
const status=(r,id)=>r.checks.find(c=>c.id==='quality-'+id).status;
test('detects invalid values, count mismatch, bad percentile ordering, and thin data',()=>{
 const r=qualityChecks({samples:[{...sample(1),confirm_ns:-1}],summaries:[{...summary,count:2,ok:1,failed:0,p50_ms:30,p95_ms:20}]},{},now);
 for(const id of ['invalid','consistency','statistics'])assert.equal(status(r,id),'issue');
});
test('learns missing categories without guessing categories on first run',()=>{
 const a=qualityChecks({summaries:[summary]},{},now);assert.equal(status(a,'coverage'),'ok');
 const b=qualityChecks({summaries:[]},a.memory,now+300000);assert.equal(status(b,'coverage'),'issue');
});
test('repeated timestamps do not count as frozen; ten distinct identical readings do',()=>{
 assert.equal(status(qualityChecks({samples:Array(10).fill(sample(1))},{},now),'frozen'),'ok');
 assert.equal(status(qualityChecks({samples:Array.from({length:10},(_,i)=>sample(i))},{},now),'frozen'),'issue');
});
test('spikes require a warm baseline and both relative and absolute thresholds',()=>{
 const telemetry={samples:Array.from({length:6},(_,i)=>sample(i,10000000+i))};let memory;
 for(let i=0;i<5;i++)memory=qualityChecks(telemetry,memory,now+i*240000).memory;
 // Keep current samples recent while building independent historical baseline observations.
 memory.baselines['nado/single/post_only/1']=Array.from({length:5},(_,i)=>({at:now-i*300000,p50:10,p95:12}));
 assert.equal(status(qualityChecks({samples:Array.from({length:6},(_,i)=>sample(i,200000000))},memory,now),'spike'),'issue');
 assert.equal(status(qualityChecks(telemetry,memory,now),'spike'),'ok');
});
test('unavailable feeds do not falsely recover anomaly checks',()=>{
 assert.equal(status(qualityChecks({}, {},now),'invalid'),'unknown');
});
