import test from "node:test";
import assert from "node:assert/strict";
import {venueChecks,zeroLatencyChecks} from "./probes.mjs";
const now=Date.parse("2026-09-17T12:00:00Z");
const sample=(overrides={})=>({venue:"lighter",scenario:"single",order_type:"post_only",plot_at:new Date(now-30000).toISOString(),ok:true,...overrides});
test("detects missing Lighter while other venues continue",()=>{const checks=venueChecks([sample({venue:"aster"})],now);assert.equal(checks.find(v=>v.name==="lighter").status,"issue");assert.equal(checks.find(v=>v.name==="aster").status,"ok")});
test("detects stale successful data even with recent failures",()=>{const v=venueChecks([sample({plot_at:new Date(now-6*60000).toISOString()}),sample({ok:false})],now)[0];assert.equal(v.status,"issue");assert.equal(v.age,360)});
test("rejects malformed payload instead of reporting passing",()=>{assert.throws(()=>venueChecks(null,now));assert.throws(()=>venueChecks([{venue:"lighter",plot_at:"broken",ok:true}],now))});
test("error ratio uses minimum sample count",()=>{assert.equal(venueChecks([sample(),sample({ok:false})],now)[0].status,"ok");assert.equal(venueChecks([sample(),sample(),sample(),sample({ok:false}),sample({ok:false})],now)[0].status,"issue")});
test("batch samples do not hide missing single-order data",()=>assert.equal(venueChecks([sample({scenario:"batch"})],now)[0].status,"issue"));

test('flags zero samples across venues and scenarios and adjusted zero',()=>{
 assert.equal(zeroLatencyChecks([sample({scenario:'batch',confirm_ns:0})],'samples',now).status,'issue');
 assert.equal(zeroLatencyChecks([sample({confirm_ns:100,network_floor_ns:200})],'samples',now).status,'issue');
 assert.equal(zeroLatencyChecks([sample({cleanup_confirm_ns:0,cleanup_account_feed:true})],'samples',now).status,'issue');
});
test('does not turn null, failed, old, or small positive samples into zero',()=>{
 for(const s of [sample({confirm_ns:null}),sample({confirm_ns:0,ok:false}),sample({confirm_ns:0,plot_at:new Date(now-16*60000).toISOString()})])assert.equal(zeroLatencyChecks([s],'samples',now).status,'unknown');
 assert.equal(zeroLatencyChecks([sample({confirm_ns:1,network_floor_ns:0})],'samples',now).status,'ok');
});
test('flags summary raw and adjusted latency, ignores baseline zeros and empty summaries',()=>{
 assert.equal(zeroLatencyChecks([{venue:'lighter',ok:2,p50_ms:0}],'summary').status,'issue');
 assert.equal(zeroLatencyChecks([{venue:'lighter',ok:2,network_adjusted_p95_ms:0}],'summary').status,'issue');
 assert.equal(zeroLatencyChecks([{venue:'lighter',ok:0,p50_ms:0}],'summary').status,'unknown');
 assert.equal(zeroLatencyChecks([{venue:'lighter',ok:2,p50_ms:0.01,network_floor_p50_ms:0,speed_bump_ms:0}],'summary').status,'ok');
});
