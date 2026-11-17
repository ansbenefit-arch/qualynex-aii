const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {apiUrl,readPath,getResponse,assertApi}=require('../lib/api-check');
const {validateSteps}=require('../lib/workflow');
function example(){return [
 {action:'apiGet',url:'/v1/health'}, {action:'assertApiStatus',value:'200'},
 {action:'assertApiJson',selector:'data.status',value:'ok'}
];}
test('API mappings validate GET and assertions, with no execution claim',()=>{
 assert.equal(validateSteps(example()).length,3);
 assert.throws(()=>validateSteps([{action:'assertApiStatus',value:'200'}]),/First step/);
 assert.throws(()=>validateSteps([{action:'apiGet',url:'/v1/health'}]),/assertion/);
 assert.throws(()=>validateSteps([{action:'apiGet',url:'/v1/health'},{action:'assertApiStatus',value:'abc'}]),/HTTP status/);
});
test('API requests reject credentials and cross-origin endpoints',()=>{
 const base=new URL('http://127.0.0.1:4177/sample-app/');
 for(const path of ['https://evil.example/api','//evil.example/api','http://u:p@127.0.0.1:4177/api']) assert.throws(()=>apiUrl(path,base),/configured test application origin/);
 assert.equal(apiUrl('/api/health',base).pathname,'/api/health');
});
test('API JSON assertions match nested own properties and never interpret prototypes',()=>{
 assert.equal(readPath({data:{status:'ok'}},'data.status'),'ok');
 assertApi({action:'assertApiStatus',value:'422'},{status:422,json:{reason:'empty'}});
 assertApi({action:'assertApiJson',selector:'reason',value:'empty'},{status:422,json:{reason:'empty'}});
 assert.throws(()=>readPath({},'constructor'),/missing/);
 assert.throws(()=>assertApi({action:'assertApiJson',selector:'reason',value:'wrong'},{json:{reason:'empty'}}),/did not match/);
});
test('API tests use actual HTTP response status, not assumed PASS',async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url==='/redirect'){res.writeHead(302,{Location:'https://evil.example/'});return res.end();}
  res.setHeader('Content-Type','application/json');
  if(req.url==='/bad'){res.statusCode=422;return res.end(JSON.stringify({valid:false,reason:'Student name is required'}));}
  res.end(JSON.stringify({valid:true,data:{status:'ok'}}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=new URL(`http://127.0.0.1:${server.address().port}/sample-app/`);
 try{
  let result=await getResponse({url:'/health'},base,{bearer:''});
  assertApi({action:'assertApiStatus',value:'200'},result);
  assertApi({action:'assertApiJson',selector:'data.status',value:'ok'},result);
  result=await getResponse({url:'/bad'},base,{bearer:''});
  assertApi({action:'assertApiStatus',value:'422'},result);
  assert.throws(()=>assertApi({action:'assertApiStatus',value:'200'},result),/received 422/);
  await assert.rejects(getResponse({url:'/redirect'},base,{bearer:''}),/redirect blocked/);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('API does not expose response body as execution metadata',async()=>{
 const res=await getResponse({url:'/health'},new URL('https://test.example/'),{
  bearer:'test-token',fetchImpl:async(url,options)=>{
   assert.equal(options.redirect,'manual');assert.equal(options.headers.Authorization,'Bearer test-token');
   return new Response(JSON.stringify({privateData:'should-not-appear'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
 });
 assert.equal(Object.keys(res).sort().join(','),'json,status,url');
});
