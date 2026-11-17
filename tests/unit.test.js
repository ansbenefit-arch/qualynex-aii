const test=require('node:test');const assert=require('node:assert/strict');
const {draftTests,TYPES}=require('../lib/generate');
const {issueKey,flatten}=require('../lib/jira');
const {targetUrl}=require('../lib/runner');
test('test matrix covers all fourteen categories',()=>{const t=draftTests({key:'ABC-1',summary:'Book session',description:'Booking',acceptanceCriteria:'Valid guardian may book'});assert.equal(t.length,14);assert.deepEqual(t.map(x=>x.type),TYPES.map(x=>x[0]));assert.ok(t.every(x=>x.status==='NOT_RUN'&&x.steps.length===0));});
test('demo test scripts contain real Playwright actions',()=>{const t=draftTests({key:'EDU-101',summary:'Booking',description:'demo',acceptanceCriteria:''});assert.equal(t.filter(x=>x.steps.length>0).length,4);});
test('jira issue keys reject malformed input',()=>{assert.equal(issueKey('abc-123'),'ABC-123');assert.throws(()=>issueKey('https://evil.example/browse/ABC-1'));assert.throws(()=>issueKey('DROP TABLE'));});
test('ADF description flattening',()=>{assert.match(flatten({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Given a user'}]}]}),/Given a user/);});
test('target app URL validates origin scheme',()=>{assert.equal(targetUrl({targetUrl:'http://127.0.0.1:4177/sample-app'}).hostname,'127.0.0.1');assert.throws(()=>targetUrl({targetUrl:'http://example.com'}));assert.throws(()=>targetUrl({targetUrl:'file:///tmp/foo'}));});
