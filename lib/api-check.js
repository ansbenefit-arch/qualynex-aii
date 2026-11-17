// Minimal, read-only, same-origin API assertion engine. No script/eval execution.
const MAX_BODY_BYTES=128*1024;
function apiUrl(raw,base){
  if(typeof raw!=='string'||!raw.trim()||raw.length>500)throw new Error('apiGet requires a relative URL (e.g. /api/health)');
  let url;try{url=new URL(raw,base);}catch{throw new Error('Invalid API URL');}
  if(url.origin!==base.origin||!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('API target must use the configured test application origin');
  return url;
}
function readPath(obj,path){
  if(typeof path!=='string'||!/^[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*){0,9}$/.test(path))throw new Error('Use a simple JSON property path such as status or data.id');
  let current=obj;
  for(const key of path.split('.')){
    if(['__proto__','prototype','constructor'].includes(key)||current===null||typeof current!=='object'||!Object.hasOwn(current,key))throw new Error('Expected JSON property is missing: '+path);
    current=current[key];
  }
  return current;
}
async function getResponse(step,base,{fetchImpl=fetch,bearer=process.env.TEST_API_BEARER_TOKEN||''}={}){
  const url=apiUrl(step.url,base);
  const headers={Accept:'application/json'};
  if(bearer)headers.Authorization=`Bearer ${bearer}`;
  let res;
  try{res=await fetchImpl(url.href,{method:'GET',redirect:'manual',headers,signal:AbortSignal.timeout(12000)});}catch{throw new Error('API request failed or timed out');}
  if(res.status>=300&&res.status<400)throw new Error('API redirect blocked to prevent cross-origin token exposure');
  const n=Number(res.headers.get('content-length'));
  if(n>MAX_BODY_BYTES)throw new Error('API response exceeds the 128 KB safety limit');
  const bytes=[];let length=0;
  if(res.body){
    const reader=res.body.getReader();
    try{
      while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BODY_BYTES)throw new Error('API response exceeds the 128 KB safety limit');bytes.push(value);}
    }finally{await reader.cancel().catch(()=>{});}
  }
  const raw=Buffer.concat(bytes.map(b=>Buffer.from(b)),length).toString('utf8');
  let json=null;
  if(raw){try{json=JSON.parse(raw);}catch{ /* Non-JSON response can still be asserted by status. */ }}
  return {status:res.status,json,url:url.pathname}; // Do not persist response bodies or credentials.
}
function assertApi(step,last){
  if(!last)throw new Error('apiGet must run before API assertions');
  if(step.action==='assertApiStatus'){
    if(last.status!==Number(step.value))throw new Error(`Expected HTTP ${step.value}, received ${last.status}`);
    return;
  }
  if(step.action==='assertApiJson'){
    if(last.json===null)throw new Error('API did not return JSON');
    const actual=readPath(last.json,step.selector);
    if(String(actual)!==step.value)throw new Error(`JSON property ${step.selector} did not match expected value`);
    return;
  }
  throw new Error('Invalid API assertion');
}
module.exports={apiUrl,readPath,getResponse,assertApi};
