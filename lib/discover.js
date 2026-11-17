const {chromium}=require('playwright');
const {targetUrl}=require('./runner');
async function discoverSmoke(settings){
  if(settings.environment==='PROD')throw new Error('Production auto-discovery is disabled');
  const base=targetUrl(settings);
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({ignoreHTTPSErrors:false});
    page.setDefaultTimeout(7000);
    await page.route('**/*',route=>{
      let url;try{url=new URL(route.request().url());}catch{return route.abort();}
      if(url.protocol==='data:'||url.protocol==='blob:'||url.origin===base.origin)return route.continue();
      return route.abort();
    });
    const response=await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:15000});
    if(!response||!response.ok())throw new Error(`Target returned HTTP ${response?.status()||'unknown'}`);
    // Discover one visible semantic heading; no input/click actions or authentication.
    const h1=page.locator('h1:visible').first();
    const h2=page.locator('h2:visible').first();
    const selector=await h1.count()?'h1:visible':await h2.count()?'h2:visible':null;
    if(!selector)throw new Error('No visible H1/H2 heading detected; map browser steps manually');
    const heading=String(await page.locator(selector).first().innerText()).trim().slice(0,100);
    if(!heading)throw new Error('Visible heading was empty');
    return {steps:[{action:'goto'},{action:'assertVisible',selector},{action:'assertText',selector,value:heading}],heading,scope:'Page smoke only. Does not establish business acceptance criteria.'};
  }finally{await browser.close();}
}
module.exports={discoverSmoke};
