const crypto = require('node:crypto');
const {id, audit} = require('./store');
const pipeline=require('./pipeline');

const ACTIONS = new Set(['goto','assertVisible','assertHidden','assertText','assertDisabled','assertEnabled','assertUrl','click','fill','apiGet','assertApiStatus','assertApiJson','dbQuery','assertDbValue']);
const ASSERTIONS = new Set(['assertVisible','assertHidden','assertText','assertDisabled','assertEnabled','assertUrl','assertApiStatus','assertApiJson','assertDbValue']);
const SELECTORS = new Set(['assertVisible','assertHidden','assertText','assertDisabled','assertEnabled','click','fill','assertApiJson','assertDbValue']);

function requirementHash(issue) {
  return crypto.createHash('sha256').update(JSON.stringify([issue.summary||'',issue.description||'',issue.acceptanceCriteria||''])).digest('hex');
}
function revokeSignoffs(s,key,reason) {
  for (const approval of s.signoffs) {
    if(approval.issueKey===key && !approval.revokedAt) {
      approval.revokedAt=new Date().toISOString();
      approval.revokedReason=reason;
    }
  }
}
function invalidateResults(s,key,reason) {
  for (const t of s.tests[key]||[]) {
    if(t.status!=='NOT_RUN')t.status='STALE';
    t.actual=`Needs new execution: ${reason}`;
    t.screenshot=null;
  }
  revokeSignoffs(s,key,reason);
}
function upsertIssue(s,issue) {
  const incomingHash=requirementHash(issue);
  const old=s.tickets.find(t=>t.key===issue.key);
  if(old) {
    const changed=(old.requirementHash||requirementHash(old))!==incomingHash;
    if(old.assignee!==issue.assignee){
      for(const d of s.defects)if(d.issueKey===issue.key && d.status!=='CLOSED')d.owner=issue.assignee;
    }
    Object.assign(old,issue,{requirementHash:incomingHash});
    if(changed) {
      old.reviewNeeded=true;
      invalidateResults(s,issue.key,'Jira requirements changed');
      audit(s,'Jira connector','REQUIREMENTS_CHANGED',issue.key);
    }
    return {changed,created:false};
  }
  s.tickets.push({...issue,requirementHash:incomingHash});
  return {changed:false,created:true};
}
function validateSteps(input) {
  if(!Array.isArray(input)||input.length<1||input.length>50)throw new Error('Provide 1 to 50 browser steps');
  if(!['goto','apiGet','dbQuery'].includes(input[0]?.action))throw new Error('First step must be goto (browser), apiGet (API), or dbQuery (SQL check)');
  if(!input.some(x=>ASSERTIONS.has(x?.action)))throw new Error('At least one assertion is required for a meaningful PASS');
  let hasApiGet=false,hasDbQuery=false;
  return input.map((step,index)=>{
    if(['assertApiStatus','assertApiJson'].includes(step?.action)&&!hasApiGet)throw new Error('API assertion must follow apiGet');
    if(step?.action==='apiGet')hasApiGet=true;
    if(step?.action==='assertDbValue'&&!hasDbQuery)throw new Error('SQL assertion must follow dbQuery');
    if(step?.action==='dbQuery')hasDbQuery=true;
    if(!step||typeof step!=='object'||Array.isArray(step)||!ACTIONS.has(step.action))throw new Error(`Invalid action at step ${index+1}`);
    if(SELECTORS.has(step.action)&& (typeof step.selector!=='string'||!step.selector.trim()||step.selector.length>300))throw new Error(`Valid selector required at step ${index+1}`);
    if(['goto','apiGet'].includes(step.action) && step.url!==undefined && (typeof step.url!=='string'||step.url.length>500))throw new Error(`Invalid URL at step ${index+1}`);
    if(step.action==='apiGet' && (typeof step.url!=='string'||!step.url.trim()))throw new Error(`apiGet requires a relative test API URL at step ${index+1}`);
    if(step.action==='dbQuery'){
      if(typeof step.checkId!=='string'||!/^[a-zA-Z][\w-]{1,63}$/.test(step.checkId))throw new Error('Approved DB check ID required');
      if(!step.params||typeof step.params!=='object'||Array.isArray(step.params)||Object.keys(step.params).length>12)throw new Error('DB parameters must be a small object');
      if(Object.entries(step.params).some(([key,value])=>!/^\w{1,64}$/.test(key)||!(typeof value==='string'||typeof value==='number'||typeof value==='boolean'||value===null)||String(value).length>300))throw new Error('Invalid DB parameter');
    }
    if(step.action==='assertApiStatus' && (!Number.isInteger(Number(step.value))||Number(step.value)<100||Number(step.value)>599))throw new Error(`HTTP status 100-599 required at step ${index+1}`);
    if(['fill','assertText','assertUrl','assertApiJson','assertDbValue'].includes(step.action) && (typeof step.value!=='string'||step.value.length>1000 || (step.action!=='fill'&&!step.value.trim())))throw new Error(`Non-empty string value required at step ${index+1}`);
    return {action:step.action,...(step.selector!==undefined?{selector:step.selector.trim()}:{}),...(step.url!==undefined?{url:step.url}:{}),...(step.value!==undefined?{value:step.value}:{}),...(step.checkId!==undefined?{checkId:step.checkId}:{}),...(step.params!==undefined?{params:step.params}:{})};
  });
}
function readiness(s,key) {
  const ticket=s.tickets.find(x=>x.key===key);
  if(!ticket)throw new Error('Ticket not found');
  const tests=s.tests[key]||[];
  const defects=s.defects.filter(d=>d.issueKey===key && d.status!=='CLOSED');
  const reasons=[];
  if(!ticket.acceptanceCriteria)reasons.push('Acceptance criteria are missing from the ticket');
  if(ticket.reviewNeeded)reasons.push('Jira requirements changed: regenerate or review the test plan');
  if(!tests.length)reasons.push('Test cases have not been generated');
  if(tests.some(t=>!Array.isArray(t.steps)||!t.steps.length))reasons.push('Some test cases lack executable mappings');
  if(tests.some(t=>t.status!=='PASS'))reasons.push('Every planned test must have a current PASS result');
  if(defects.length)reasons.push(`${defects.length} unresolved defect(s)`);
  const ciReason=pipeline.readinessReason(s,key);if(ciReason)reasons.push(ciReason);
  return {eligible:!reasons.length,reasons,total:tests.length,pass:tests.filter(t=>t.status==='PASS').length,fail:tests.filter(t=>t.status==='FAIL').length,blocked:tests.filter(t=>t.status==='BLOCKED').length,stale:tests.filter(t=>t.status==='STALE').length,unmapped:tests.filter(t=>!t.steps?.length).length,openDefects:defects.length,latestSignoff:s.signoffs.find(a=>a.issueKey===key&&!a.revokedAt)||null};
}
function recordFailure(s,ticket,selected,result) {
  const existing=s.defects.find(d=>d.issueKey===ticket.key && d.testId===result.testId && d.status!=='CLOSED');
  if(existing) {
    existing.status='OPEN';
    existing.message=result.actual;
    existing.lastFailedAt=new Date().toISOString();
    return {defect:existing,created:false};
  }
  const test=selected.find(t=>t.id===result.testId);
  const defect={id:id('bug'),issueKey:ticket.key,testId:result.testId,title:test?.title||result.testId,message:result.actual,status:'OPEN',owner:ticket.assignee,jiraBugKey:null,createdAt:new Date().toISOString()};
  s.defects.unshift(defect);
  return {defect,created:true};
}
module.exports={requirementHash,revokeSignoffs,invalidateResults,upsertIssue,validateSteps,readiness,recordFailure};
