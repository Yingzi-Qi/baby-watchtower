import {readFile,writeFile,mkdir,rename} from "node:fs/promises";
import path from "node:path";
import {runProbes} from "../lib/probes.mjs";
import {sendGmail} from "./gmail.mjs";
import {deliverEmail} from "./email.mjs";
import {qualityChecks} from "../lib/quality.mjs";
import {browserChecks} from "../lib/browser-checks.mjs";
import {advance} from "./state.mjs";
const statePath=process.env.MONITOR_STATE_PATH??".monitor/state.json";
const outputPath=process.env.MONITOR_OUTPUT_PATH??"public/data/dashboard.json";
async function writeJson(p,data){await mkdir(path.dirname(p),{recursive:true});await writeFile(p+".tmp",JSON.stringify(data,null,2)+"\n");await rename(p+".tmp",p)}
let old;try{old=JSON.parse(await readFile(statePath,"utf8"))}catch(e){if(e.code!=="ENOENT")throw e}
const snapshot=await runProbes();
const quality=qualityChecks(snapshot.telemetry,old?.qualityMemory,Date.parse(snapshot.checkedAt));
snapshot.checks.push(...quality.checks,...await browserChecks());
for(const c of snapshot.checks)if(c.id.startsWith('zero-'))c.severity='warning';
delete snapshot.telemetry;
const state=advance(old,snapshot);state.qualityMemory=quality.memory;
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
let gmailTestError=false;
if(process.env.GMAIL_USER&&process.env.GMAIL_APP_PASSWORD&&process.env.ALERT_EMAIL_TO&&!state.gmailConfirmed){
 try{await sendGmail({subject:"Baby Watchtower email alerts connected",text:"This is a setup confirmation from Baby Watchtower. Confirmed incidents and recoveries will be sent to this address. Monitoring results and their timestamp are available on the dashboard.\nhttps://yingzi-qi.github.io/baby-watchtower/"});state.gmailConfirmed=true}catch{gmailTestError=true}
}
const email=await deliverEmail(state);
email.testAccepted=!!state.gmailConfirmed;
email.deliveryError=email.deliveryError||gmailTestError;
if(email.deliveryError)console.error("Email delivery failed; queued for the next run.");
const deliveryIssues=[];
if(email.deliveryError)deliveryIssues.push({id:'email-delivery',site:'monitor',name:'Email delivery failed',status:'issue',detail:'Notification delivery failed; the next check will retry.'});
if(deliveryError)deliveryIssues.push({id:'telegram-delivery',site:'monitor',name:'Telegram delivery failed',status:'issue',detail:'Notification delivery failed; the next check will retry.'});
state.snapshot.checks.push(...deliveryIssues);
await writeJson(statePath,state);
await writeJson(outputPath,{snapshot:state.snapshot,incidents:state.incidents,history:state.history.slice(0,60),email,telegram:ready,pendingAlerts:ready?state.incidents.filter(i=>!i.open_sent||(i.resolved_at&&!i.recovery_sent)).length:0,deliveryError});
console.log(JSON.stringify({checkedAt:state.snapshot.checkedAt,checks:state.snapshot.checks.length,issues:state.history[0].issues,openIncidents:state.incidents.filter(i=>!i.resolved_at).length,telegramConfigured:ready}));
