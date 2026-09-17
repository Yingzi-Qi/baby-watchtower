import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMonitor} from './index.mjs';
async function fixture(run,now){
 const dir=await mkdtemp(path.join(os.tmpdir(),'watchtower-'));
 const app=createMonitor({env:{DATA_DIR:dir},run,now});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 return {...app,dir,url:'http://127.0.0.1:'+app.server.address().port,async close(){await app.stop();await rm(dir,{recursive:true,force:true})}};
}
test('concurrent refresh requests share a run; global cooldown applies',async()=>{
 let calls=0,release,clock=100000;
 const app=await fixture(()=>{calls++;return new Promise(r=>release=r)},()=>clock);
 try{
  const [a,b]=await Promise.all([fetch(app.url+'/api/check',{method:'POST'}),fetch(app.url+'/api/check',{method:'POST'})]);assert.equal(a.status,202);assert.equal(b.status,202);assert.equal(calls,1);
  release();await new Promise(r=>setImmediate(r));
  const c=await (await fetch(app.url+'/api/check',{method:'POST'})).json();assert.equal(c.cooldown,60);assert.equal(calls,1);
  clock+=61000;await fetch(app.url+'/api/check',{method:'POST'});assert.equal(calls,2);release();
 }finally{await app.close()}
});
test('public results persist, origins are checked, failed checker is visible',async()=>{
 const app=await fixture(async()=>{throw Error('private error')},()=>100000);
 try{
  await writeFile(path.join(app.dir,'dashboard.json'),JSON.stringify({snapshot:{checkedAt:new Date(99000).toISOString()},incidents:[]}));
  let r=await fetch(app.url+'/api/dashboard',{headers:{Origin:'https://yingzi-qi.github.io'}});assert.equal(r.headers.get('access-control-allow-origin'),'https://yingzi-qi.github.io');assert.ok((await r.json()).snapshot);
  assert.equal((await fetch(app.url+'/api/check',{method:'POST',headers:{Origin:'https://example.com'}})).status,403);
  await fetch(app.url+'/api/check',{method:'POST'});await new Promise(r=>setImmediate(r));r=await fetch(app.url+'/api/dashboard');const result=await r.json();assert.equal(result.monitor.lastError,true);assert.equal(JSON.stringify(result).includes('private error'),false);
 }finally{await app.close()}
});
