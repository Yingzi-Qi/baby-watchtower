import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function sendGmail(payload,env=process.env){
 return new Promise((resolve,reject)=>{
  const child=spawn('python3',[fileURLToPath(new URL('./gmail.py',import.meta.url))],{env:{...process.env,...env},stdio:['pipe','ignore','ignore'],timeout:30000});
  child.on('error',()=>reject(Error('Gmail delivery failed')));
  child.on('close',code=>code===0?resolve():reject(Error('Gmail delivery failed')));
  child.stdin.on('error',()=>reject(Error('Gmail delivery failed')));
  child.stdin.end(JSON.stringify(payload));
 });
}
