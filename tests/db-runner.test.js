const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db-check');
const {execute}=require('../lib/runner');
const settings={environment:'DEV',targetUrl:'http://127.0.0.1:4177/sample-app/'};
const tc={id:'EDU-101-TC-09',steps:[{action:'dbQuery',checkId:'sql-connectivity',params:{}},{action:'assertDbValue',selector:'connected',value:'1'}]};
test('DB-only test executes without launching Playwright and does not fabricate PASS',async()=>{
 const orig=db.runCheck;
 const run='test-db-only-'+process.pid;
 try{
  db.runCheck=async()=>({checkId:'sql-connectivity',row:{connected:1}});
  let result=await execute([tc],settings,run);
  assert.equal(result[0].status,'PASS');
  assert.match(result[0].actual,/DB:sql-connectivity:connected/);
  assert.equal(result[0].screenshot,null);
  result=await execute([{...tc,steps:[tc.steps[0],{...tc.steps[1],value:'0'}]}],settings,run);
  assert.equal(result[0].status,'FAIL');
  assert.doesNotMatch(result[0].actual,/received/);
  db.runCheck=async()=>{throw new db.DatabaseUnavailable('SQL driver unavailable');};
  result=await execute([tc],settings,run);
  assert.equal(result[0].status,'BLOCKED');
  await assert.rejects(execute([tc],{...settings,environment:'PROD'},run),/Production execution disabled/);
 }finally{
  db.runCheck=orig;
  require('node:fs').rmSync(require('node:path').join(__dirname,'..','evidence',run),{recursive:true,force:true});
 }
});
