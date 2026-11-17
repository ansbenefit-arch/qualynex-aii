const test=require('node:test');
const assert=require('node:assert/strict');
const {acceptanceChecks,fromSnapshot}=require('../lib/smart-plan');
const {draftTests}=require('../lib/generate');
const T={key:'EDU-101',demo:true,summary:'Guardian can schedule',acceptanceCriteria:'Given a guardian, When booking valid session, Then confirmation appears. Given no student name, Then validation error appears.'};
const required=['app-heading','schedule','studentName','date','book','success','error','cancel','booking'];
function snapshot(ids=required){return {elements:ids.map((id,i)=>({selector:'#'+id,tag:i===0?'h1':i===2?'input':'button',visible:i===0,text:i===0?'Education Portal Dashboard':''}))};}
const tests=draftTests(T);
test('acceptance criteria is broken into two readable independent checks',()=>{
 const criteria=acceptanceChecks(T);
 assert.equal(criteria.length,2);
 assert.match(criteria[0].criterion,/confirmation/);
 assert.match(criteria[1].criterion,/validation error/);
});
test('demo fixture maps four observed safe Playwright cases, not 14 imaginary passes',()=>{
 const plans=fromSnapshot(T,tests,snapshot(),new URL('http://127.0.0.1:4177/sample-app'));
 assert.deepEqual(plans.map(x=>x.type).sort(),['Negative','Positive','Regression','Smoke']);
 assert.ok(plans.every(x=>x.steps[0].action==='goto'));
 assert.ok(plans.every(x=>x.reviewRequired===false));
});
test('external target only proposes structural smoke, never auto-clicks booking',()=>{
 const plans=fromSnapshot({...T,demo:false},tests,snapshot(),new URL('https://dev.example.org/dashboard'));
 assert.deepEqual(plans.map(x=>x.type),['Smoke']);
 assert.ok(plans[0].steps.some(s=>s.action==='assertText'));
});
test('wrong page path prevents demo business mappings',()=>{
 const plans=fromSnapshot(T,tests,snapshot(),new URL('http://127.0.0.1:4177/not-the-demo'));
 assert.deepEqual(plans.map(x=>x.type),['Smoke']);
});
test('missing selectors prevent business mappings instead of inventing locators',()=>{
 const plans=fromSnapshot(T,tests,snapshot(['app-heading','schedule']),new URL('http://localhost:4177/sample-app'));
 assert.deepEqual(plans.map(x=>x.type),['Smoke']);
});
test('page with no heading cannot falsely pass even smoke',()=>{
 const plans=fromSnapshot({...T,demo:false},tests,{elements:[]},new URL('https://dev.example.org/dashboard'));
 assert.deepEqual(plans,[]);
});
