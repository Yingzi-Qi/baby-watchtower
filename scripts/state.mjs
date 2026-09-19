export function advance(previous,snapshot){
 const state=structuredClone(previous??{states:{},incidents:[],history:[]});
 state.states??={};state.incidents??=[];state.history??=[];
 if(state.snapshot&&Date.parse(snapshot.checkedAt)<=Date.parse(state.snapshot.checkedAt))throw Error("Non-increasing observation timestamp");
 for(const c of snapshot.checks){
 const old=state.states[c.id]??{failures:0,passes:0};
 if(c.status==="unknown"){state.states[c.id]={failures:0,passes:0};continue}
 const bad=c.status==="issue",failures=bad?old.failures+1:0,passes=bad?0:old.passes+1;
 state.states[c.id]={failures,passes};
 const incident=state.incidents.find(i=>i.check_id===c.id&&!i.resolved_at);
 if(!incident&&failures>=2)state.incidents.unshift({id:c.id+"-"+snapshot.checkedAt,check_id:c.id,site:c.site,name:c.name,severity:c.severity??"error",detail:c.detail,opened_at:snapshot.checkedAt,resolved_at:null,open_sent:0,recovery_sent:0});
 if(incident&&bad)incident.detail=c.detail;
 if(incident&&passes>=2)incident.resolved_at=snapshot.checkedAt;
 }
 state.snapshot=snapshot;
 state.history.unshift({checked_at:snapshot.checkedAt,issues:snapshot.checks.filter(c=>c.status==="issue").length});
 state.history=state.history.slice(0,2016);
 state.incidents=[...state.incidents.filter(i=>!i.resolved_at),...state.incidents.filter(i=>i.resolved_at).slice(0,200)].sort((a,b)=>b.opened_at.localeCompare(a.opened_at));
 return state;
}
