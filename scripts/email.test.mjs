import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverEmail} from './email.mjs';
const env={RESEND_API_KEY:'test',ALERT_EMAIL_FROM:'sender@example.com',ALERT_EMAIL_TO:'recipient@example.com'};
const incident=()=>({id:'one',name:'Feed',detail:'Missing',opened_at:'2026-09-17T00:00:00Z',resolved_at:null,open_sent:1});
test('email independently sends once and sends recovery',async()=>{
 const state={incidents:[incident()]};let count=0;
 const send=async()=>{count++;return {ok:true,json:async()=>({id:'accepted'})}};
 await deliverEmail(state,env,send);await deliverEmail(state,env,send);assert.equal(count,1);
 state.incidents[0].resolved_at='2026-09-17T01:00:00Z';await deliverEmail(state,env,send);assert.equal(count,2);
});
test('failed requests retry with identical payload and idempotency key',async()=>{
 const state={incidents:[incident()]};let original;
 const r=await deliverEmail(state,env,async(_,args)=>{original=args;throw Error('timeout')});assert.equal(r.pending,1);assert.equal(r.deliveryError,true);
 state.incidents[0].detail='Changed';
 await deliverEmail(state,env,async(_,args)=>{assert.equal(args.body,original.body);assert.equal(args.headers['Idempotency-Key'],original.headers['Idempotency-Key']);return {ok:true,json:async()=>({id:'accepted'})}});
 assert.equal(state.incidents[0].email.open,true);
});
test('activation skips historical resolved incidents and requires full configuration',async()=>{
 const state={incidents:[{...incident(),resolved_at:'2026-09-17T01:00:00Z'}]};
 assert.equal((await deliverEmail(state,{})).configured,false);assert.equal(state.emailActivated,undefined);
 await deliverEmail(state,env,()=>{throw Error('Must not send historical incident')});assert.equal(state.incidents[0].email.recovery,true);
});
