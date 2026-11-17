const test=require('node:test');
const assert=require('node:assert/strict');
const {upsertIssue,readiness,validateSteps,recordFailure,invalidateResults} = require('../lib/workflow');
function fixture(){
 const issue={key:'ABC-1',summary:'Book a session',description:'Form sends booking',acceptanceCriteria:'Valid booking is confirmed',status:'Ready',assignee:'Dev A'};
 const s={tickets:[],tests:{},runs:[],defects:[],signoffs:[],audit:[]};upsertIssue(s,issue);
 s.tests['ABC-1']=[{id:'ABC-1-TC-01',type:'Smoke',steps:[{action:'goto'},{action:'assertVisible',selector:'h1'}],status:'PASS',actual:'Validated',screenshot:'/evidence/a.png'}];
 return {s,issue};
}
test('browser mapping requires a real assertion and bounded safe steps',()=>{
 assert.deepEqual(validateSteps([{action:'goto'},{action:'assertVisible',selector:'h1'}]),[{action:'goto'},{action:'assertVisible',selector:'h1'}]);
 assert.throws(()=>validateSteps([{action:'goto'},{action:'click',selector:'#buy'}]),/assertion/);
 assert.throws(()=>validateSteps([{action:'fill',selector:'input',value:'hello'}]),/goto/);
 assert.throws(()=>validateSteps([{action:'goto'},{action:'assertVisible',selector:'h1'},{action:'eval',value:'bad'}]),/Invalid action/);
 assert.throws(()=>validateSteps([{action:'goto'},{action:'assertText',selector:'h1'}]),/string value/);
});
test('unchanged status sync preserves PASS; requirement change stales results and revokes sign-off',()=>{
 const {s,issue}=fixture();s.signoffs.push({issueKey:'ABC-1',approver:'Tester',when:'2026-01-01'});
 assert.equal(upsertIssue(s,{...issue,status:'In QA',assignee:'Dev B'}).changed,false);
 assert.equal(s.tests['ABC-1'][0].status,'PASS');
 assert.equal(upsertIssue(s,{...issue,description:'Booking now checks date too'}).changed,true);
 assert.equal(s.tests['ABC-1'][0].status,'STALE');
 assert.ok(s.signoffs[0].revokedAt);
});
test('sign-off blocked when tests are not all passed or defects are open',()=>{
 const {s}=fixture();
 assert.equal(readiness(s,'ABC-1').eligible,true);
 s.tests['ABC-1'].push({id:'ABC-1-TC-02',steps:[],status:'NOT_RUN'});
 assert.equal(readiness(s,'ABC-1').eligible,false);
 s.tests['ABC-1'].pop();s.defects.push({id:'bug-1',issueKey:'ABC-1',testId:'ABC-1-TC-01',status:'OPEN'});
 assert.equal(readiness(s,'ABC-1').eligible,false);
 s.defects[0].status='CLOSED';assert.equal(readiness(s,'ABC-1').eligible,true);
});
test('repeated failure deduplicates same open bug and reopens failed pending retest',()=>{
 const {s,issue}=fixture();const result={testId:'ABC-1-TC-01',status:'FAIL',actual:'Text mismatch'};
 const r1=recordFailure(s,issue,s.tests['ABC-1'],result);assert.equal(r1.created,true);
 const r2=recordFailure(s,issue,s.tests['ABC-1'],result);assert.equal(r2.created,false);
 assert.equal(s.defects.length,1);s.defects[0].status='FIXED_PENDING_RETEST';
 recordFailure(s,issue,s.tests['ABC-1'],{...result,actual:'Still failing'});
 assert.equal(s.defects[0].status,'OPEN');assert.equal(s.defects[0].message,'Still failing');
});
test('changing target invalidates all previous results',()=>{
 const {s}=fixture();invalidateResults(s,'ABC-1','Environment changed');
 assert.equal(s.tests['ABC-1'][0].status,'STALE');assert.equal(s.tests['ABC-1'][0].screenshot,null);
});
