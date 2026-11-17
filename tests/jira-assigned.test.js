const test=require('node:test');
const assert=require('node:assert/strict');
const jira=require('../lib/jira');
test('Jira assigned-to-me uses enhanced JQL and nextPageToken pagination',async()=>{
 const saved={base:process.env.JIRA_BASE_URL,email:process.env.JIRA_EMAIL,token:process.env.JIRA_API_TOKEN};
 const original=global.fetch;
 process.env.JIRA_BASE_URL='https://example.atlassian.net';process.env.JIRA_EMAIL='qa@example.test';process.env.JIRA_API_TOKEN='test-in-memory-only';
 const requests=[];
 global.fetch=async(url,opts)=>{
  const body=JSON.parse(opts.body);requests.push({url,body});
  const issue=n=>({key:`APP-${n}`,fields:{summary:`Task ${n}`,description:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Given valid input Then saved'}]}]},status:{name:'In Progress'},assignee:{displayName:'Test Account'},updated:'2026-11-16T00:00:00Z'}});
  return new Response(JSON.stringify(requests.length===1?{issues:[issue(1)],nextPageToken:'page-2',isLast:false}:{issues:[issue(2)],isLast:true}),{status:200,headers:{'Content-Type':'application/json'}});
 };
 try{
  const issues=await jira.getAssignedIssues();
  assert.deepEqual(issues.map(x=>x.key),['APP-1','APP-2']);
  assert.equal(requests[0].body.jql,'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC');
  assert.equal(requests[1].body.nextPageToken,'page-2');
  assert.ok(requests[0].url.endsWith('/rest/api/3/search/jql'));
 }finally{
  global.fetch=original;
  if(saved.base===undefined)delete process.env.JIRA_BASE_URL;else process.env.JIRA_BASE_URL=saved.base;
  if(saved.email===undefined)delete process.env.JIRA_EMAIL;else process.env.JIRA_EMAIL=saved.email;
  if(saved.token===undefined)delete process.env.JIRA_API_TOKEN;else process.env.JIRA_API_TOKEN=saved.token;
 }
});
