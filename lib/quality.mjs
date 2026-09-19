const key=r=>[r.venue,r.scenario,r.order_type,r.batch_size??1].join('/');
const quantile=(xs,q)=>[...xs].sort((a,b)=>a-b)[Math.min(xs.length-1,Math.floor(xs.length*q))];
export function qualityChecks(telemetry,previous={},now=Date.now()){
 const memory=structuredClone(previous),checks=[];
 const add=(id,name,problems,known=true)=>checks.push({id:'quality-'+id,site:'latency',name,status:!known?'unknown':problems.length?'issue':'ok',severity:'warning',detail:problems.slice(0,6).join('; ')||'No anomaly detected',url:'https://latency.perps.trading/'});
 const samples=Array.isArray(telemetry.samples)?telemetry.samples.filter(r=>r&&typeof r==='object'):null,summary=Array.isArray(telemetry.summaries)?telemetry.summaries.filter(r=>r&&typeof r==='object'):null;
 const invalid=[],inconsistent=[],thin=[],frozen=[],spikes=[],missing=[];
 if(samples)for(const r of samples){
  const timestamp=Date.parse(r.plot_at);
  if(!Number.isFinite(timestamp)||timestamp>now+60000)invalid.push(`${key(r)}: invalid or future timestamp`);
  if(r.ok&&!(typeof r.confirm_ns==='number'&&Number.isFinite(r.confirm_ns)))invalid.push(`${key(r)}: successful sample has no numeric confirmation latency`);
  for(const [field,value] of Object.entries(r))if(field.endsWith('_ns')&&value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0))invalid.push(`${key(r)}: invalid ${field}`);
 }
 if(summary)for(const r of summary){
  for(const [field,value] of Object.entries(r))if(field.endsWith('_ms')&&value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<0))invalid.push(`${key(r)}: invalid ${field}`);
  if(r.count!==r.ok+r.failed)inconsistent.push(`${key(r)}: total does not equal successes plus failures`);
  for(const prefix of ['','raw_','network_adjusted_']){
   const ps=['p50_ms','p95_ms','p99_ms','p999_ms'].map(f=>r[prefix+f]);
   if(ps.some((v,i)=>i&&Number.isFinite(v)&&Number.isFinite(ps[i-1])&&v<ps[i-1]))inconsistent.push(`${key(r)}: ${prefix}percentiles out of order`);
  }
  if(r.ok>0&&r.ok<5)thin.push(`${key(r)}: statistics based on only ${r.ok} successful samples`);
  if(r.count>=5&&r.failed/r.count>0.2)thin.push(`${key(r)}: ${r.failed}/${r.count} measurements failed; latency describes successful measurements only`);
 }
 if(summary){
  memory.categories??={};const present=new Set(summary.map(key));
  for(const [k,last] of Object.entries(memory.categories))if(now-last<7*86400000&&!present.has(k))missing.push(`${k}: previously observed category absent from summary`);
  for(const r of summary)if(r.count>0)memory.categories[key(r)]=now;
  for(const [k,last] of Object.entries(memory.categories))if(now-last>=7*86400000)delete memory.categories[k];
 }
 if(samples){
  const groups=new Map();
  for(const r of samples)if(r.ok&&Date.parse(r.plot_at)>now-900000&&Date.parse(r.plot_at)<=now+60000&&Number.isFinite(r.confirm_ns)&&r.confirm_ns>0){const k=key(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)}
  memory.baselines??={};
  for(const [k,rows] of groups){
   const unique=[...new Map(rows.map(r=>[r.plot_at,r])).values()].sort((a,b)=>Date.parse(b.plot_at)-Date.parse(a.plot_at));
   if(unique.length>=10&&new Set(unique.slice(0,10).map(r=>r.confirm_ns)).size===1)frozen.push(`${k}: 10 successive timestamps have exactly identical latency`);
   if(unique.length<5)continue;
   const values=unique.map(r=>r.confirm_ns/1e6),p50=quantile(values,.5),p95=quantile(values,.95);
   const old=(memory.baselines[k]??[]).filter(x=>now-x.at<86400000);
   if(old.length>=5){
    for(const metric of ['p50','p95']){const baseline=quantile(old.map(x=>x[metric]),.5),value=metric==='p50'?p50:p95;if(value>baseline*3&&value-baseline>50)spikes.push(`${k}: ${metric} ${value.toFixed(1)} ms vs usual ${baseline.toFixed(1)} ms (over 3× and +50 ms)`)}
   }
   if(!old.length||now-old.at(-1).at>=240000)old.push({at:now,p50,p95});memory.baselines[k]=old.slice(-72);
  }
 }
 if(samples&&summary){
  const counts=new Map();for(const r of samples)if(r.ok&&Date.parse(r.plot_at)>now-86400000&&Date.parse(r.plot_at)<=now)counts.set(key(r),(counts.get(key(r))??0)+1);
  for(const r of summary)if((counts.get(key(r))??0)>r.ok+5)inconsistent.push(`${key(r)}: recent successful sample count exceeds 24-hour summary by more than 5`);
 }
 add('invalid','Invalid measurements',invalid,!!samples||!!summary);
 add('coverage','Missing measurement category',missing,!!summary);
 add('frozen','Repeated measurements',frozen,!!samples);
 add('spike','Latency spike',spikes,!!samples);
 add('statistics','Unreliable statistics',thin,!!summary);
 add('consistency','Inconsistent data',inconsistent,!!summary);
 return {checks,memory};
}
