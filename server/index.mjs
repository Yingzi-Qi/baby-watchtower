import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function runChecker(env){
 return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['scripts/check.mjs'],{cwd:root,env,stdio:['ignore','ignore','ignore'],timeout:180000,killSignal:'SIGKILL'});
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Check failed')));
 });
}
export function createMonitor({env=process.env,run=runChecker,now=Date.now}={}){
 const dir=env.DATA_DIR||path.join(root,'.monitor');
 const output=path.join(dir,'dashboard.json');
 const runnerEnv={...env,MONITOR_STATE_PATH:path.join(dir,'state.json'),MONITOR_OUTPUT_PATH:output,HOSTED_MONITOR:'1'};
 let running=false,lastStart=0,lastError=false,active;
 async function data(){try{return JSON.parse(await readFile(output,'utf8'))}catch(e){if(e.code==='ENOENT')return null;throw e}}
 function trigger(){
  if(running)return {running:true,cooldown:0};
  const cooldown=Math.max(0,Math.ceil((lastStart+60000-now())/1000));
  if(lastStart&&cooldown)return {running:false,cooldown};
  running=true;lastStart=now();
  active=Promise.resolve().then(()=>run(runnerEnv)).then(()=>{lastError=false},()=>{lastError=true}).finally(()=>{running=false});
  return {running:true,cooldown:0};
 }
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const origin=req.headers.origin;
  const allowed=(env.ALLOWED_ORIGIN||'https://yingzi-qi.github.io').split(',');
  if(origin==='https://'+req.headers.host||origin==='http://'+req.headers.host)allowed.push(origin);
  if(origin&&allowed.includes(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin')}
  function json(status,value){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))}
  try{
   if(url.pathname.startsWith('/api/')&&origin&&!allowed.includes(origin)){json(403,{error:'Origin not allowed'});return}
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});res.end();return}
   if(url.pathname==='/healthz'){
    const d=await data();const healthy=d?.snapshot&&now()-Date.parse(d.snapshot.checkedAt)<300000;
    json(healthy||(!lastError&&now()-lastStart<180000)?200:503,{healthy:!!healthy,running});return;
   }
   if(url.pathname==='/api/check'&&req.method==='POST'){req.resume();const status=trigger();json(status.running?202:200,status);return}
   if(url.pathname==='/api/dashboard'&&req.method==='GET'){json(200,{...await data(),monitor:{hosted:true,running,lastError,intervalSeconds:60,cooldownSeconds:Math.max(0,Math.ceil((lastStart+60000-now())/1000))}});return}
   if(url.pathname==='/runtime-config.json'){json(200,{backendUrl:'/api'});return}
   if(req.method!=='GET'&&req.method!=='HEAD'){json(405,{error:'Method not allowed'});return}
   const file=path.resolve(root,'docs','.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   const staticRoot=path.join(root,'docs')+path.sep;
   if(!file.startsWith(staticRoot)){json(404,{error:'Not found'});return}
   if(!(await stat(file)).isFile()){json(404,{error:'Not found'});return}
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime});res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{json(500,{error:'Unable to load monitoring results'})}
 });
 let timer;
 return {server,trigger,start(){trigger();timer=setInterval(trigger,1000)},async stop(){clearInterval(timer);await active;await new Promise(resolve=>server.close(resolve))}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const dir=process.env.DATA_DIR||path.join(root,'.monitor');
 if(process.env.STATE_SEED_URL){
  try{await stat(path.join(dir,'state.json'))}catch(e){
   if(e.code!=='ENOENT')throw e;
   const r=await fetch(process.env.STATE_SEED_URL,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Unable to migrate incident history');
   const state=await r.json();if(!state.snapshot||!Array.isArray(state.incidents)||!state.states)throw Error('Invalid migration snapshot');
   await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'state.json.tmp'),JSON.stringify(state));await rename(path.join(dir,'state.json.tmp'),path.join(dir,'state.json'));
  }
 }
 const monitor=createMonitor();monitor.server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>monitor.start());
 process.on('SIGTERM',()=>{monitor.stop().then(()=>process.exit(0));setTimeout(()=>process.exit(1),200000).unref()});
}
