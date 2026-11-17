// Load Playwright only for UI runs; API and DB checks run without Chromium dependency.
const {getResponse,assertApi}=require('./api-check');
const db=require('./db-check');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..','evidence');
const ASSERTIONS=new Set(['assertVisible','assertHidden','assertText','assertDisabled','assertEnabled','assertUrl','assertApiStatus','assertApiJson','assertDbValue']);
const ACTIONS=new Set(['goto','assertVisible','assertHidden','assertText','assertDisabled','assertEnabled','assertUrl','click','fill','apiGet','assertApiStatus','assertApiJson','dbQuery','assertDbValue']);
function targetUrl(settings){
  const raw=settings.targetUrl;
  if(!raw)throw new Error('Set a permitted test target URL first.');
  let url;try{url=new URL(raw);}catch{throw new Error('Target URL is invalid');}
  if(!['http:','https:'].includes(url.protocol))throw new Error('Only HTTP(S) test targets are supported');
  if(!['127.0.0.1','localhost'].includes(url.hostname) && url.protocol!=='https:')throw new Error('Remote targets must use HTTPS');
  return url;
}
async function executeCase(browser,tc,settings,runId){
  if(!Array.isArray(tc.steps)||tc.steps.length===0)return {testId:tc.id,status:'BLOCKED',actual:'No verified browser steps. Map selectors, data and expected outcomes before execution.',screenshot:null};
  if(!tc.steps.some(step=>ASSERTIONS.has(step.action)))return {testId:tc.id,status:'BLOCKED',actual:'No assertions configured. Action-only scripts are not valid tests.',screenshot:null};
  const base=targetUrl(settings);
  const browserUsed=tc.steps.some(x=>!['apiGet','assertApiStatus','assertApiJson','dbQuery','assertDbValue'].includes(x.action));
  let context=null,page=null;
  if(browserUsed){
    if(!browser)throw new Error('Browser engine is required for UI actions');
    context=await browser.newContext({ignoreHTTPSErrors:false});
    page=await context.newPage();
    page.setDefaultTimeout(6500);
    await page.route('**/*',async route=>{
      const req=route.request();const url=req.url();
      if(url.startsWith('data:')||url.startsWith('blob:')||url==='about:blank')return route.continue();
      let next;try{next=new URL(url);}catch{return route.abort();}
      if(next.origin!==base.origin)return route.abort('blockedbyclient');
      return route.continue();
    });
  }
  let status='PASS', actual='Validated every configured browser/API assertion.';
  let apiResult=null,dbResult=null;
  const verified=[];
  const dir=path.join(ROOT,runId); fs.mkdirSync(dir,{recursive:true});
  const shot=`${tc.id.replace(/[^a-z0-9_-]/gi,'_')}.png`;
  try{
    for(const step of tc.steps){
      if(!ACTIONS.has(step.action))throw new Error(`Unsupported action: ${step.action}`);
      if(step.action==='apiGet'){
        apiResult=await getResponse(step,base);
      } else if(['assertApiStatus','assertApiJson'].includes(step.action)){
        assertApi(step,apiResult);verified.push(step.action);
      } else if(step.action==='dbQuery'){
        dbResult=await db.runCheck(step);
      } else if(step.action==='assertDbValue'){
        db.assertDb(step,dbResult);verified.push('DB:'+dbResult.checkId+':'+step.selector);
      } else if(step.action==='goto'){
        const dest=step.url?new URL(step.url,base):base;
        if(dest.origin!==base.origin)throw new Error('Cross-origin navigation is blocked');
        const response=await page.goto(dest.href,{waitUntil:'domcontentloaded',timeout:15000});
        if(!response||!response.ok())throw new Error(`Page HTTP status: ${response?.status()||'no response'}`);
      } else if(step.action==='assertVisible'){
        await page.locator(step.selector).first().waitFor({state:'visible'});
      } else if(step.action==='assertHidden'){
        await page.locator(step.selector).first().waitFor({state:'hidden'});
      } else if(step.action==='assertText'){
        const value=await page.locator(step.selector).first().innerText();
        if(!value.includes(String(step.value)))throw new Error(`Expected text not found: ${String(step.value).slice(0,100)}`);
      } else if(step.action==='assertDisabled'){
        if(!await page.locator(step.selector).first().isDisabled())throw new Error('Element was not disabled');
      } else if(step.action==='assertEnabled'){
        if(!await page.locator(step.selector).first().isEnabled())throw new Error('Element was not enabled');
      } else if(step.action==='assertUrl'){
        if(!page.url().includes(String(step.value)))throw new Error('URL assertion failed');
      } else if(step.action==='click'){
        await page.locator(step.selector).first().click();
      } else if(step.action==='fill'){
        await page.locator(step.selector).first().fill(String(step.value??''));
      }
    }
    if(verified.length)actual='Verified assertions: '+verified.join(', ');
  }catch(error){status=error instanceof db.DatabaseUnavailable?'BLOCKED':'FAIL';actual=String(error.message).slice(0,1400);}
  let screenshot=null;
  if(browserUsed)try{await page.screenshot({path:path.join(dir,shot),fullPage:true});screenshot=`/evidence/${runId}/${shot}`;}catch{}
  if(context)await context.close();
  return {testId:tc.id,status,actual,screenshot};
}
async function execute(tests,settings,runId){
  if(settings.environment.toUpperCase().includes('PROD'))throw new Error('Production execution disabled. Use an authorized non-production environment.');
  targetUrl(settings);
  const mapped=tests.some(t=>t.steps?.length);
  if(!mapped)return tests.map(t=>({testId:t.id,status:'BLOCKED',actual:'No executable steps available',screenshot:null}));
  // API-only and SQL-only runs do not need Chromium or a browser binary.
  const browserNeeded=tests.some(t=>t.steps?.some(x=>!['apiGet','assertApiStatus','assertApiJson','dbQuery','assertDbValue'].includes(x.action)));
  let browser=null;
  if(browserNeeded){
    const options={headless:true};
    if(process.env.PLAYWRIGHT_EXECUTABLE_PATH)options.executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH;
    const {chromium}=require('playwright');
    browser=await chromium.launch(options);
  }
  try{
    const results=[];
    for(const item of tests)results.push(await executeCase(browser,item,settings,runId));
    return results;
  }finally{if(browser)await browser.close();}
}
module.exports={execute,targetUrl};
