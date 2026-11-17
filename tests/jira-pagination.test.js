const test=require('node:test');const assert=require('node:assert/strict');
const jira=require('../lib/jira');
test('Jira Agile sprint pagination uses startAt and collects multiple pages',async()=>{
 const old={...process.env};const originalFetch=global.fetch;const requests=[];
 try {
  process.env.JIRA_BASE_URL='https://sample.atlassian.net';process.env.JIRA_EMAIL='tester@example.com';process.env.JIRA_API_TOKEN='test-token';
  global.fetch=async url=>{
   const u=new URL(url);requests.push(u.pathname+u.search);
   if(u.pathname.endsWith('/sprint/42'))return {ok:true,status:200,json:async()=>({name:'Sprint 42'})};
   const page=Number(u.searchParams.get('startAt')||0);
   return {ok:true,status:200,json:async()=>({startAt:page,total:2,issues:[{key:page===0?'ABC-1':'ABC-2',fields:{summary:'Test',description:'Hello'}}]})};
  };
  const keys=(await jira.getSprintIssues(42)).map(x=>x.key);
  assert.deepEqual(keys,['ABC-1','ABC-2']);
  assert.ok(requests.includes('/rest/agile/1.0/sprint/42/issue?maxResults=50&startAt=1'));
 }finally{global.fetch=originalFetch;for(const key of ['JIRA_BASE_URL','JIRA_EMAIL','JIRA_API_TOKEN']){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
