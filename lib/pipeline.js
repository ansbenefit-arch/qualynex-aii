'use strict';
// v0.6: read-only GitHub Actions adapter. It never dispatches builds or writes to GitHub.
const REPO_RE = /^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;
function repository(){
  const value=String(process.env.GITHUB_REPOSITORY||'').trim();
  if(!value) return null;
  const match=REPO_RE.exec(value);
  if(!match || match[2]==='.' || match[2]==='..') throw new Error('GITHUB_REPOSITORY must be owner/repo');
  return {owner:match[1],repo:match[2],fullName:value};
}
function configured(){return Boolean(repository() && process.env.GITHUB_TOKEN && process.env.GITHUB_WORKFLOW);}
function assertBranch(value){
  if(typeof value!=='string') throw new Error('Enter the exact source branch name');
  const branch=value.trim();
  if(!branch||branch.length>160||branch.startsWith('/')||branch.endsWith('/')||branch.includes('..')||branch.includes('//')||/[\s~^:?*\[\\\x00-\x1f\x7f]/.test(branch)||branch.endsWith('.lock')||branch.startsWith('-'))throw new Error('Invalid Git branch name');
  return branch;
}
function workflowName(){
  const workflow=String(process.env.GITHUB_WORKFLOW||'').trim();
  if(!workflow)throw new Error('Set GITHUB_WORKFLOW (e.g. ci.yml) to identify the required CI checks, not any unrelated workflow');
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(workflow)||workflow==='.'||workflow==='..')throw new Error('Invalid GITHUB_WORKFLOW');
  return workflow;
}
function normalize(run,expectedBranch){
  if(!run||!Number.isSafeInteger(run.id)||!['queued','in_progress','completed','waiting','requested','pending','action_required'].includes(run.status)) throw new Error('Unexpected GitHub Actions run response');
  if(run.head_branch!==expectedBranch)throw new Error('GitHub returned a run for another branch');
  const conclusion=run.status==='completed'?String(run.conclusion||'unknown'):'pending';
  return {id:run.id,attempt:Number.isSafeInteger(run.run_attempt)?run.run_attempt:1, name:String(run.name||'').slice(0,160), branch:run.head_branch,
    status:run.status,conclusion,sha:String(run.head_sha||'').slice(0,64),url:typeof run.html_url==='string'&&/^https:\/\/github\.com\//.test(run.html_url)?run.html_url:null,
    createdAt:String(run.created_at||''),updatedAt:String(run.updated_at||''),checkedAt:new Date().toISOString()};
}
function identity(run){return `${run.id}:${run.attempt}:${run.status}:${run.conclusion}:${run.sha}`;}
async function latest(branch, fetcher=fetch){
  const repo=repository();if(!repo||!process.env.GITHUB_TOKEN)throw new Error('Configure GITHUB_REPOSITORY and a read-only GITHUB_TOKEN in .env');
  const workflow=workflowName(), name=assertBranch(branch);
  const url=`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/actions/workflows/${encodeURIComponent(workflow)}/runs?branch=${encodeURIComponent(name)}&per_page=10`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  let response;
  try{response=await fetcher(url,{headers:{'Accept':'application/vnd.github+json','Authorization':`Bearer ${process.env.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'QASphere-AI-local-pilot'},signal:controller.signal,redirect:'error'});}finally{clearTimeout(timer);}
  if(!response.ok)throw new Error(`GitHub Actions check failed (HTTP ${response.status}). Verify repo, workflow name and Actions:read permissions.`);
  const data=await response.json();if(!Array.isArray(data.workflow_runs))throw new Error('GitHub Actions response did not contain workflow runs');
  // Do not accept unrelated branch results, even if upstream search is unexpected.
  const runs=data.workflow_runs.filter(r=>r?.head_branch===name && Number.isSafeInteger(r.id)).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0) || b.id-a.id);
  return runs.length?normalize(runs[0],name):null;
}
function ensureState(s){s.pipeline ||= {links:{},history:[]};s.pipeline.links ||= {};s.pipeline.history ||= [];return s.pipeline;}
function linkTicket(s,key,branch){
  const p=ensureState(s);const value=assertBranch(branch);const previous=p.links[key];
  if(previous?.branch===value)return {link:previous,changed:false};
  const link={branch:value,linkedAt:new Date().toISOString(),latest:null,retestRunId:null,retestBuildIdentity:null};
  p.links[key]=link;
  return {link,changed:true};
}
function updateObservation(s,key,run){
  const p=ensureState(s),link=p.links[key];if(!link)throw new Error('Link the ticket to a branch first');
  const old=link.latest;const changed=identity(old||{id:0,attempt:0,status:'none',conclusion:'none',sha:''})!==identity(run||{id:0,attempt:0,status:'none',conclusion:'none',sha:''});
  link.latest=run;
  if(changed){link.retestRunId=null;link.retestBuildIdentity=null;
    p.history.unshift({ticket:key,branch:link.branch,runId:run?.id||null,status:run?.status||'not_found',conclusion:run?.conclusion||'unknown',sha:run?.sha||'',checkedAt:new Date().toISOString()});p.history=p.history.slice(0,100);
  }
  return {changed,link};
}
function markRetested(s,key,build,runId){
  const link=ensureState(s).links[key];
  if(!link||!link.latest||identity(link.latest)!==identity(build)||build.status!=='completed'||build.conclusion!=='success')throw new Error('Build changed before retest could be linked');
  link.retestRunId=runId;link.retestBuildIdentity=identity(build);link.retestedAt=new Date().toISOString();delete link.retestError;
}
function readinessReason(s,key){
  const link=s.pipeline?.links?.[key];if(!link)return null;
  if(!link.latest)return 'CI/CD branch linked but no GitHub Actions build verified';
  if(link.latest.status!=='completed')return 'Latest GitHub Actions build has not completed';
  if(link.latest.conclusion!=='success')return `Latest GitHub Actions build result is ${link.latest.conclusion} (not success)`;
  if(link.retestBuildIdentity!==identity(link.latest)||!link.retestRunId)return 'No local QA retest recorded for the latest successful CI build';
  return null;
}
module.exports={repository,configured,assertBranch,workflowName,normalize,identity,latest,ensureState,linkTicket,updateObservation,markRetested,readinessReason};
