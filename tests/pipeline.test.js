'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const pipeline=require('../lib/pipeline');const {readiness,upsertIssue,invalidateResults}=require('../lib/workflow');
function fixture(){
  const ticket={key:'APP-17',summary:'Safe booking',description:'Business requirement',acceptanceCriteria:'Valid booking is confirmed'};
  const s={tickets:[],tests:{},runs:[],defects:[],signoffs:[],audit:[]};upsertIssue(s,ticket);
  s.tests['APP-17']=[{id:'APP-17-TC-01',steps:[{action:'goto'},{action:'assertVisible',selector:'h1'}],status:'PASS'}];return s;
}
const success={id:101,run_attempt:1,name:'QA CI',head_branch:'feature/APP-17',head_sha:'a'.repeat(40),status:'completed',conclusion:'success',html_url:'https://github.com/example/example/actions/runs/101',created_at:'2026-11-17T07:00:00Z'};
test('repository and branch validation prevents ambiguous destinations',()=>{
  assert.equal(pipeline.assertBranch('feature/APP-17'),'feature/APP-17');
  for(const name of ['','../foo','bad branch','bad\\branch','../main','feature//bad','a.lock'])assert.throws(()=>pipeline.assertBranch(name));
  const old=process.env.GITHUB_REPOSITORY;
  try{process.env.GITHUB_REPOSITORY='some org/repo';assert.throws(()=>pipeline.repository());process.env.GITHUB_REPOSITORY='example/my-app';assert.deepEqual(pipeline.repository(),{owner:'example',repo:'my-app',fullName:'example/my-app'});}finally{if(old===undefined)delete process.env.GITHUB_REPOSITORY;else process.env.GITHUB_REPOSITORY=old;}
});
test('read-only GitHub latest run uses named workflow, branch and fixed API host',async()=>{
  const vars=['GITHUB_REPOSITORY','GITHUB_TOKEN','GITHUB_WORKFLOW'];const saved=Object.fromEntries(vars.map(k=>[k,process.env[k]]));
  try{process.env.GITHUB_REPOSITORY='example/app';process.env.GITHUB_TOKEN='test-only-secret';process.env.GITHUB_WORKFLOW='ci.yml';
    let url, options;
    const run=await pipeline.latest('feature/APP-17',async(u,o)=>{url=u;options=o;return {ok:true,status:200,json:async()=>({workflow_runs:[{...success,head_branch:'main'},success]})};});
    assert.equal(run.id,101);assert.match(url,/api\.github\.com\/repos\/example\/app\/actions\/workflows\/ci.yml\/runs/);
    assert.match(url,/branch=feature%2FAPP-17/);assert.equal(options.headers.Authorization,'Bearer test-only-secret');assert.equal(options.redirect,'error');
    await assert.rejects(()=>pipeline.latest('feature/APP-17',async()=>({ok:false,status:403})),/HTTP 403/);
    const none=await pipeline.latest('feature/APP-17',async()=>({ok:true,status:200,json:async()=>({workflow_runs:[{...success,head_branch:'main'}]})}));assert.equal(none,null);
  }finally{for(const k of vars)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}
});
test('linking branch never creates QA PASS and blocks sign-off before a real retest',()=>{
  const s=fixture();assert.equal(readiness(s,'APP-17').eligible,true);
  const l=pipeline.linkTicket(s,'APP-17','feature/APP-17');assert.equal(l.changed,true);
  assert.match(readiness(s,'APP-17').reasons.join(','),/CI\/CD branch linked/);
  assert.equal(pipeline.linkTicket(s,'APP-17','feature/APP-17').changed,false);
  const observation=pipeline.updateObservation(s,'APP-17',pipeline.normalize(success,'feature/APP-17'));
  assert.equal(observation.changed,true);assert.match(readiness(s,'APP-17').reasons.join(','),/No local QA retest/);
  pipeline.markRetested(s,'APP-17',observation.link.latest,'run-local-123');
  assert.equal(readiness(s,'APP-17').eligible,true);
});
test('failed or pending builds block sign-off; a new commit revokes previous local retest',()=>{
  const s=fixture();pipeline.linkTicket(s,'APP-17','feature/APP-17');
  const successRun=pipeline.normalize(success,'feature/APP-17');pipeline.updateObservation(s,'APP-17',successRun);pipeline.markRetested(s,'APP-17',successRun,'run-local-123');
  assert.equal(readiness(s,'APP-17').eligible,true);
  const pending=pipeline.normalize({...success,id:102,status:'in_progress',conclusion:null},'feature/APP-17');pipeline.updateObservation(s,'APP-17',pending);
  assert.match(readiness(s,'APP-17').reasons.join(','),/has not completed/);
  const failed=pipeline.normalize({...success,id:102,status:'completed',conclusion:'failure'},'feature/APP-17');pipeline.updateObservation(s,'APP-17',failed);
  assert.match(readiness(s,'APP-17').reasons.join(','),/failure/);
  assert.equal(s.pipeline.links['APP-17'].retestRunId,null);
  const latest=pipeline.normalize({...success,id:103,head_sha:'b'.repeat(40)},'feature/APP-17');pipeline.updateObservation(s,'APP-17',latest);
  invalidateResults(s,'APP-17','New build');assert.equal(s.tests['APP-17'][0].status,'STALE');
  assert.match(readiness(s,'APP-17').reasons.join(','),/No local QA retest/);
});
test('GitHub workflow run success is not equivalent to a passed QA test',()=>{
  const s=fixture();pipeline.linkTicket(s,'APP-17','feature/APP-17');const run=pipeline.normalize(success,'feature/APP-17');pipeline.updateObservation(s,'APP-17',run);
  s.tests['APP-17'][0].status='FAIL';pipeline.markRetested(s,'APP-17',run,'run-failed-qa');
  assert.equal(readiness(s,'APP-17').eligible,false);
  assert.match(readiness(s,'APP-17').reasons.join(','),/Every planned test/);
});
