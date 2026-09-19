export async function browserChecks(){
 const sites=[['litscan','https://litscan.io/'],['latency','https://latency.perps.trading/']];
 let browser;
 try{
  const {chromium}=await import('playwright');browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 }catch{return sites.map(([site,url])=>({id:site+'-render',site,name:'Browser check unavailable',status:'issue',detail:'Browser runtime could not start; visual rendering is unverified.',url}))}
 try{return await Promise.all(sites.map(async([site,url])=>{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,180)));
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:25000});
   await page.waitForFunction(()=>document.body.innerText.trim().length>150,{},{timeout:20000});
   if(site==='latency')await page.locator('svg[role="img"] path[d]').first().waitFor({state:'attached',timeout:20000});
   const visible=await page.locator('body').innerText();
   if(/application error|something went wrong|unable to load|failed to fetch/i.test(visible))errors.push('Page displays an application or data-loading error');
   return {id:site+'-render',site,name:site==='latency'?'Chart rendering failure':'Page rendering failure',status:errors.length?'issue':'ok',detail:errors.join('; ')||'Page rendered without uncaught JavaScript errors'+(site==='latency'?' and chart paths are present':''),url};
  }catch{return {id:site+'-render',site,name:'Page or chart failed to render',status:'issue',detail:'Page content or chart paths did not appear within the browser check timeout.',url}}
  finally{await page.close()}
 }))}finally{await browser.close()}
}
