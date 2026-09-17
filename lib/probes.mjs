export const VENUES=["lighter","hyperliquid","extended","nado","aster"];
export function venueChecks(samples,now=Date.now()){
 if(!Array.isArray(samples)||samples.some(s=>!s||typeof s.venue!=="string"||typeof s.ok!=="boolean"||(!Number.isFinite(Date.parse(s.plot_at))||Date.parse(s.plot_at)>now+60000)))throw Error("Invalid sample schema");
 return VENUES.map(name=>{const rows=samples.filter(s=>s.venue===name&&s.scenario==="single"&&s.order_type==="post_only"&&Date.parse(s.plot_at)>now-15*60000);
 const good=rows.filter(s=>s.ok),latest=Math.max(0,...good.map(s=>Date.parse(s.plot_at))), age=latest?Math.max(0,(now-latest)/1000):null,failed=rows.filter(s=>!s.ok).length;
 return {name,count:rows.length,failed,age,status:age===null||age>300||(rows.length>=5&&failed/rows.length>0.2)?"issue":"ok"};
 });
}
async function request(url,json=false){
 const start=Date.now(),r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{"User-Agent":"BabyWatchtower/1.0"},cache:"no-store"});
 if(!r.ok)throw Error("HTTP "+r.status);
 const body=await r.text();if(body.length>8000000)throw Error("Response exceeds safety limit");
 return {body:json?JSON.parse(body):body,ms:Date.now()-start};
}
export async function runProbes(){
 const checks=[],venues=[];const now=Date.now();
 const add=(id,site,name,status,detail,url,ms)=>checks.push({id,site,name,status:ms>5000&&status==="ok"?"issue":status,detail:ms>5000?"Response exceeded 5 seconds. "+detail:detail,url,...(ms!==undefined?{ms}:{})});
 await Promise.all([["litscan","https://litscan.io/","Litscan"],["latency","https://latency.perps.trading/","Perps Latency Benchmark"]].map(async([site,url,title])=>{
 try{const r=await request(url);const matches=r.body.toLowerCase().includes("<title>"+title.toLowerCase()+"</title>");
 add(site+"-page",site,"Page availability",matches&&r.ms<5000?"ok":"issue",!matches?"Expected page title missing":r.ms>=5000?"Response exceeded 5 seconds":"HTTP 200 with expected page title",url,r.ms);
 const asset=r.body.match(/(?:src|href)="([^"]+\.js)"/)?.[1];
 if(!asset)add(site+"-asset",site,"JavaScript asset","issue","No JavaScript entry point found",url);
 else{const assetUrl=new URL(asset,url);if(assetUrl.origin!==new URL(url).origin)throw Error("Entry point moved to an unverified origin");try{const a=await request(assetUrl.href);add(site+"-asset",site,"JavaScript asset",a.body.length>50&&!a.body.trimStart().startsWith("<")?"ok":"issue","Entry point is reachable; execution is not tested",assetUrl.href,a.ms)}catch(e){add(site+"-asset",site,"JavaScript asset","issue",e.message,assetUrl.href)}}
 }catch(e){add(site+"-page",site,"Page availability","issue",e.name==="TimeoutError"?"Request timed out after 12 seconds":e.message,url);add(site+"-asset",site,"JavaScript asset","unknown","Page unavailable; asset not checked",url)}
 }));
 const base="https://latency.perps.trading/api/bench/";
 await Promise.all([
 (async()=>{const url=base+"health";try{const {body:d,ms}=await request(url,true);const age=(now-Date.parse(d.updated_at))/1000;add("health","latency","Benchmark service health",d.ok===true&&Number.isFinite(age)&&age<300&&age>-60?"ok":"issue","Service reports "+String(d.ok)+"; updated "+String(d.updated_at),url,ms)}catch(e){add("health","latency","Benchmark service health","issue",e.message,url)}})(),
 (async()=>{const url=base+"latest?window=24h";try{const {body:d,ms}=await request(url,true);if(!Array.isArray(d.summaries)||d.summaries.some(s=>!s||typeof s.venue!=="string"||![s.count,s.ok,s.failed].every(n=>Number.isFinite(n)&&n>=0)))throw Error("Invalid summaries schema");const age=(now-Date.parse(d.updated_at))/1000;add("summary","latency","Summary data & freshness",d.summaries.length&&Number.isFinite(age)&&age<300&&age>-60?"ok":"issue",d.summaries.length+" summary rows; updated "+String(d.updated_at),url,ms)}catch(e){add("summary","latency","Summary data & freshness","issue",e.message,url)}})(),
 (async()=>{const url=base+"latency-series?window=15m&limit=1000";try{const {body:d,ms}=await request(url,true);const vs=venueChecks(d.samples,now);venues.push(...vs);add("samples","latency","Recent sample feed",d.samples.length?"ok":"issue",d.samples.length+" returned samples; per-venue checks use the last 15 minutes",url,ms);for(const v of vs)add("venue-"+v.name,"latency",v.name+" data continuity",v.status,v.age===null?"No successful single post-only samples in the last 15 minutes":Math.round(v.age)+"s since successful sample; "+v.failed+"/"+v.count+" recent samples failed",url)}catch(e){add("samples","latency","Recent sample feed","issue",e.message,url);for(const v of VENUES)add("venue-"+v,"latency",v+" data continuity","unknown","Sample feed unavailable; venue state cannot be evaluated",url)}})()
 ]);
 return {checkedAt:new Date().toISOString(),checks:checks.sort((a,b)=>a.id.localeCompare(b.id)),venues};
}
