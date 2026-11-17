const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const Module=require('node:module');
const path=require('node:path');
const fs=require('node:fs');
// Replaces the browser module only in this isolated test worker to prove API-only
// execution does not try to launch/download Chromium.
const original=Module._load;
let launches=0;
Module._load=function(request,parent,isMain){
 if(request==='playwright')return {chromium:{launch:async()=>{launches++;throw new Error('Chromium should not start');}}};
 return original.apply(this,arguments);
};
const {execute}=require('../lib/runner');
Module._load=original;
test('API-only execution produces evidence-backed result without Chromium',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({ready:true}));});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const settings={environment:'DEV',targetUrl:`http://127.0.0.1:${server.address().port}/`};
 const runId=`test-api-${process.pid}`;
 const tc={id:'APP-TC-08',steps:[{action:'apiGet',url:'/health'},{action:'assertApiStatus',value:'200'},{action:'assertApiJson',selector:'ready',value:'true'}]};
 try{
  const results=await execute([tc,{id:'APP-TC-09',steps:[]}],settings,runId);
  assert.deepEqual(results.map(x=>x.status),['PASS','BLOCKED']);
  assert.equal(results[0].screenshot,null);
  assert.equal(launches,0);
  const failed=await execute([{...tc,steps:[tc.steps[0],{action:'assertApiStatus',value:'404'}]}],settings,runId);
  assert.equal(failed[0].status,'FAIL');
  assert.equal(failed[0].actual.includes('received 200'),true);
  await assert.rejects(execute([tc],{...settings,environment:'PROD'},runId),/Production execution disabled/);
 }finally{
  server.closeAllConnections();await new Promise(done=>server.close(done));
  fs.rmSync(path.join(__dirname,'..','evidence',runId),{recursive:true,force:true});
 }
});
