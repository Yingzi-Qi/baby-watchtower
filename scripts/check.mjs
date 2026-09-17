import {readFile,writeFile,mkdir,rename} from "node:fs/promises";
import path from "node:path";
import {runProbes} from "../lib/probes.mjs";
import {advance} from "./state.mjs";
const statePath=process.env.MONITOR_STATE_PATH??".monitor/state.json";
const outputPath=process.env.MONITOR_OUTPUT_PATH??"public/data/dashboard.json";
async function writeJson(p,data){await mkdir(path.dirname(p),{recursive:true});await writeFile(p+".tmp",JSON.stringify(data,null,2)+"\n");await rename(p+".tmp",p)}
let old;try{old=JSON.parse(await readFile(statePath,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
const state=advance(old,await runProbes());
const ready=!!(process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID);
let deliveryError=false;
if(ready){
 for(const i of state.incidents.filter(i=>!i.open_sent||(i.resolved_at&&!i.recovery_sent)).slice(0,5)){
 try{
 const recovered=!!i.resolved_at;
 const r=await fetch("https://api.telegram.org/bot"+process.env.TELEGRAM_BOT_TOKEN+"/sendMessage",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:(recovered?"RECOVERED":"INCIDENT")+" · Baby Watchtower\n"+i.name+"\n"+i.detail+"\nOpened: "+i.opened_at+(recovered?"\nRecovered: "+i.resolved_at:"")+"\nhttps://yingzi-qi.github.io/baby-watchtower/",disable_web_page_preview:true}),signal:AbortSignal.timeout(10000)});
 const result=await r.json();if(!r.ok||!result.ok)throw Error("Telegram delivery failed");
 i.open_sent=1;if(recovered)i.recovery_sent=1;
 }catch{deliveryError=true;console.error("Telegram delivery failed; queued for the next run.");break}
 }
}
await writeJson(statePath,state);
await writeJson(outputPath,{snapshot:state.snapshot,incidents:state.incidents,history:state.history.slice(0,60),telegram:ready,pendingAlerts:ready?state.incidents.filter(i=>!i.open_sent||(i.resolved_at&&!i.recovery_sent)).length:0,deliveryError});
console.log(JSON.stringify({checkedAt:state.snapshot.checkedAt,checks:state.snapshot.checks.length,issues:state.history[0].issues,openIncidents:state.incidents.filter(i=>!i.resolved_at).length,telegramConfigured:ready}));
