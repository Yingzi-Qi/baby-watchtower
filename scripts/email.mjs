import {sendGmail} from './gmail.mjs';
import {createHash} from 'node:crypto';
export async function deliverEmail(state,env=process.env,send=fetch,gmail=sendGmail){
 const useGmail=!!(env.GMAIL_USER&&env.GMAIL_APP_PASSWORD&&env.ALERT_EMAIL_TO);
 const configured=useGmail||!!(env.RESEND_API_KEY&&env.ALERT_EMAIL_FROM&&env.ALERT_EMAIL_TO);
 if(!configured)return {configured:false,pending:0,deliveryError:false};
 if(!state.emailActivated){
  for(const i of state.incidents)if(i.resolved_at)i.email={open:true,recovery:true};
  state.emailActivated=true;
 }
 let deliveryError=false,attempts=0;
 for(const i of state.incidents){
  i.email??={};
  const phase=i.resolved_at?'recovery':'open';
  if(i.email[phase])continue;
  if(attempts++>=5)break;
  i.email.pending??={phase,subject:`${phase==='recovery'?'RECOVERED':'INCIDENT'} · Baby Watchtower · ${i.name}`,text:`${i.name}\n${i.detail}\nOpened: ${i.opened_at}${i.resolved_at?'\nRecovered: '+i.resolved_at:''}\nhttps://yingzi-qi.github.io/baby-watchtower/`};
  const p=i.email.pending;
  try{
   if(useGmail){await gmail({subject:p.subject,text:p.text},env)}else{
   const response=await send('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':createHash('sha256').update(i.id+':'+p.phase).digest('hex')},body:JSON.stringify({from:env.ALERT_EMAIL_FROM,to:[env.ALERT_EMAIL_TO],subject:p.subject,text:p.text}),signal:AbortSignal.timeout(10000)});
   const result=await response.json();
   if(!response.ok||!result.id)throw Error('Email delivery failed');
   }
   i.email[p.phase]=true;if(p.phase==='recovery')i.email.open=true;delete i.email.pending;
  }catch{deliveryError=true;break}
 }
 const pending=state.incidents.filter(i=>!i.email?.[i.resolved_at?'recovery':'open']).length;
 return {configured:true,provider:useGmail?"gmail":"resend",pending,deliveryError};
}
