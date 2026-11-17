require('dotenv').config();
const express=require('express');
const path=require('node:path');
const {load,save,id,audit}=require('./lib/store');
const jira=require('./lib/jira');
const db=require('./lib/db-check');
const pipeline=require('./lib/pipeline');
const {draftTests,aiEnrich}=require('./lib/generate');
const {execute,targetUrl}=require('./lib/runner');
const {workbookFor}=require('./lib/report');
const {propose}=require('./lib/developer');
const {upsertIssue,invalidateResults,revokeSignoffs,validateSteps,readiness,recordFailure}=require('./lib/workflow');
const {discoverSmoke}=require('./lib/discover');
const smart=require('./lib/smart');
const {requirementHash}=require('./lib/workflow');
const app=express();const PORT=Number(process.env.PORT||4177);const RELEASE='0.6.0';
app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));
app.use((req,res,next)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    const origin=req.headers.origin;
    if(origin){try { const url=new URL(origin);if(!['localhost','127.0.0.1'].includes(url.hostname)||url.port!==String(PORT))return res.status(403).json({error:'Local origin required'}); }catch{return res.status(403).json({error:'Invalid origin'});}}
  }next();
});
const staticRoot=path.join(__dirname,'public');
app.use('/evidence',express.static(path.join(__dirname,'evidence'),{fallthrough:false}));
app.use(express.static(staticRoot));
function wrap(fn){return (req,res)=>Promise.resolve().then(()=>fn(req,res)).catch(err=>{console.error(`[${new Date().toISOString()}]`,err.message);res.status(err.status||400).json({error:err.message||'Unexpected error'});});}
function find(s,key){const ticket=s.tickets.find(t=>t.key===key);if(!ticket)throw Object.assign(new Error('Ticket not found'),{status:404});return ticket;}

function validSettings(input,s){const clean={...s.settings};for(const field of ['organization','project','domain','workspace','testerMode','database','environment','targetUrl'])if(typeof input[field]==='string')clean[field]=input[field].trim().slice(0,300);if(clean.targetUrl)targetUrl(clean);if(!['DEV','STG','SIT','UAT','PROD'].includes(clean.environment))throw new Error('Invalid environment');if(!['Tester','Developer','Production'].includes(clean.workspace))throw new Error('Invalid workspace');return clean;}
function summary(s){return {...s,release:RELEASE,connection:{jira:jira.configured(),database:db.configured(),databaseDriver:db.driverInstalled(),ci:pipeline.configured(),ciRepository:pipeline.repository()?.fullName||null,ciWorkflow:process.env.GITHUB_WORKFLOW||null,openAI:Boolean(process.env.OPENAI_API_KEY),jiraWrites:process.env.JIRA_WRITE_ENABLED==='1'},build:'Local prototype - no authentication or production deployment'};}
// Bundled read-only API contract fixture, not a real booking service.
app.get('/api/demo/booking/validate',(req,res)=>{
  const name=String(req.query.studentName||'').trim();const date=String(req.query.date||'').trim();
  if(!name)return res.status(422).json({valid:false,reason:'Student name is required'});
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(422).json({valid:false,reason:'Valid date is required'});
  return res.json({valid:true,fixture:'API validation only; no booking created'});
});
app.get('/api/state',wrap((req,res)=>res.json(summary(load()))));
app.get('/api/status',wrap((req,res)=>res.json({jira:jira.configured(),boardId:process.env.JIRA_BOARD_ID||null,ai:Boolean(process.env.OPENAI_API_KEY),writeEnabled:process.env.JIRA_WRITE_ENABLED==='1',release:RELEASE})));
app.post('/api/jira/check',wrap(async(req,res)=>res.json(await jira.checkConnection())));
app.get('/api/db/catalog',wrap((req,res)=>res.json(db.catalog())));
app.post('/api/db/check',wrap(async(req,res)=>{if(running)throw new Error('Cannot check SQL Server during test execution');const result=await db.checkConnection();const s=load();audit(s,'SQL connector','DB_CONNECTION_VERIFIED','Read-only connection check; no user table queried');save(s);res.json(result);}));
app.post('/api/settings',wrap((req,res)=>{if(running)throw new Error('Wait for current test run before changing target');const s=load();const old=s.settings;const next=validSettings(req.body||{},s);if(old.targetUrl!==next.targetUrl||old.environment!==next.environment){for(const ticket of s.tickets)invalidateResults(s,ticket.key,'Test target or environment changed');s.smartAnalyses={};for(const link of Object.values(s.pipeline?.links||{})){link.retestRunId=null;link.retestBuildIdentity=null;}}s.settings=next;audit(s,'Local user','UPDATE_SETTINGS',s.settings.environment);save(s);res.json(summary(s));}));
app.post('/api/tickets/import',wrap(async(req,res)=>{
  if(running)throw new Error('Ticket sync is unavailable during test execution');
  const key=jira.issueKey(req.body.url||req.body.key);let issue;
  if(key.startsWith('EDU-')&&!jira.configured()){issue=load().tickets.find(t=>t.key===key);if(!issue)throw new Error('Demo issue not available');}
  else issue=await jira.getIssue(key);
  const s=load();const change=upsertIssue(s,issue);if(change.changed){s.smartAnalyses ||= {};delete s.smartAnalyses[key];}if(!s.tests[key])s.tests[key]=draftTests(issue);
  audit(s,'Jira connector','ISSUE_SYNCED',key);save(s);res.json({issue,tests:s.tests[key]});
}));
async function syncSprint(sprintId){const issues=await jira.getSprintIssues(sprintId);const s=load();for(const issue of issues){const change=upsertIssue(s,issue);if(change.changed){s.smartAnalyses ||= {};delete s.smartAnalyses[issue.key];}if(!s.tests[issue.key])s.tests[issue.key]=draftTests(issue);}audit(s,'Jira connector','SPRINT_SYNC',`${sprintId}: ${issues.length} issues`);save(s);return {count:issues.length,issues:issues.map(t=>t.key)};}
app.post('/api/tickets/assigned',wrap(async(req,res)=>{
  if(running)throw new Error('Ticket sync unavailable during execution');
  if(!jira.configured())throw new Error('Configure Jira Cloud in .env first');
  const issues=await jira.getAssignedIssues();
  const s=load();
  for(const issue of issues){
    const change=upsertIssue(s,issue);
    if(change.changed){s.smartAnalyses ||= {};delete s.smartAnalyses[issue.key];}
    if(!s.tests[issue.key])s.tests[issue.key]=draftTests(issue);
  }
  audit(s,'Jira connector','SYNC_ASSIGNED',`${issues.length} assigned open issues`);
  save(s);res.json({count:issues.length,keys:issues.map(i=>i.key),note:'Read-only import. Jira status is not changed.'});
}));
app.post('/api/tickets/sprint',wrap(async(req,res)=>{if(running)throw new Error('Sprint sync is unavailable during test execution');if(!jira.configured())throw new Error('Connect Jira in .env to sync sprints');const sprintId=req.body.sprintId||await jira.getActiveSprintId(process.env.JIRA_BOARD_ID);if(!sprintId)throw new Error('No active sprint found: supply Sprint ID or Board ID');res.json(await syncSprint(sprintId));}));
app.post('/api/tickets/:key/generate',wrap(async(req,res)=>{if(running)throw new Error('Cannot regenerate during test execution');const s=load(),t=find(s,req.params.key);let tests=draftTests(t);if(req.body?.ai===true)tests=await aiEnrich(t,tests);revokeSignoffs(s,t.key,'Test plan regenerated');s.tests[t.key]=tests;t.reviewNeeded=false;s.smartAnalyses ||= {};delete s.smartAnalyses[t.key];audit(s,'Local user','GENERATE_TESTS',`${t.key} ${req.body?.ai?'AI requested':'template'}`);save(s);res.json({tests});}));
app.post('/api/tickets/:key/demo-api-map',wrap((req,res)=>{
  if(running)throw new Error('Cannot map steps during execution');
  const s=load(),ticket=find(s,req.params.key);
  if(ticket.key!=='EDU-101'||!ticket.demo)throw new Error('API fixture mapping is available only for EDU-101 demo');
  const base=targetUrl(s.settings);
  if(!['127.0.0.1','localhost'].includes(base.hostname)||base.port!==String(PORT))throw new Error('Use the bundled QASphere demo target first');
  const tc=(s.tests[ticket.key]||[]).find(t=>t.type==='API');
  if(!tc)throw new Error('Generate the test matrix first');
  tc.steps=validateSteps([
    {action:'apiGet',url:'/api/demo/booking/validate?studentName=Alex&date=2026-12-01'},
    {action:'assertApiStatus',value:'200'},
    {action:'assertApiJson',selector:'valid',value:'true'},
    {action:'apiGet',url:'/api/demo/booking/validate?date=2026-12-01'},
    {action:'assertApiStatus',value:'422'},
    {action:'assertApiJson',selector:'reason',value:'Student name is required'}
  ]);
  tc.source='Bundled read-only API validation fixture (not real booking backend)';
  tc.status='NOT_RUN';tc.actual='';tc.screenshot=null;
  revokeSignoffs(s,ticket.key,'API fixture mapping changed');
  audit(s,'Local user','MAP_DEMO_API',ticket.key);save(s);res.json({test:tc});
}));
app.get('/api/tickets/:key/readiness',wrap((req,res)=>res.json(readiness(load(),req.params.key))));
app.post('/api/tickets/:key/map',wrap((req,res)=>{
  if(running)throw new Error('Cannot change test steps during a run');
  const s=load(),ticket=find(s,req.params.key);
  const tc=(s.tests[ticket.key]||[]).find(x=>x.id===req.body?.testId);
  if(!tc)throw new Error('Test ID not found for this ticket');
  tc.steps=validateSteps(req.body?.steps);
  tc.source='Mapped browser/API assertions - local user';tc.status='NOT_RUN';tc.actual='';tc.screenshot=null;
  revokeSignoffs(s,ticket.key,'Browser mapping changed');
  audit(s,'Local user','MAP_EXECUTION_STEPS',`${ticket.key} ${tc.id} (${tc.steps.length} steps)`);
  save(s);res.json({test:tc});
}));
app.post('/api/tickets/:key/auto-map-smoke',wrap(async(req,res)=>{
  if(running)throw new Error('Cannot discover during a running test');
  const s=load(),ticket=find(s,req.params.key);
  if(!s.tests[ticket.key])s.tests[ticket.key]=draftTests(ticket);
  const tc=s.tests[ticket.key].find(x=>x.type==='Smoke');
  if(!tc)throw new Error('No Smoke test available: regenerate test matrix first');
  const discovered=await discoverSmoke(s.settings);
  tc.steps=validateSteps(discovered.steps);tc.source='Auto-discovered page smoke only';
  tc.status='NOT_RUN';tc.actual='';tc.screenshot=null;
  revokeSignoffs(s,ticket.key,'Smoke mapping changed');
  audit(s,'Browser discovery','AUTO_MAP_SMOKE',`${ticket.key}: visible heading found`);
  save(s);res.json({test:tc,heading:discovered.heading,scope:discovered.scope});
}));
let running=false;
// Read-only DOM discovery; explicit AI mode sends bounded UI metadata + ticket criteria to provider.
app.post('/api/tickets/:key/smart-analyze',wrap(async(req,res)=>{
  if(running)throw new Error('Wait for the active test run');
  running=true;
  try{
    const s=load(),ticket=find(s,req.params.key);
    if(!s.tests[ticket.key])s.tests[ticket.key]=draftTests(ticket);
    const analysis=await smart.analyze(ticket,s.settings,s.tests[ticket.key],{withAI:req.body?.ai===true});
    s.smartAnalyses ||= {};s.smartAnalyses[ticket.key]=analysis;
    audit(s,'Browser analyst',req.body?.ai===true?'SMART_ANALYZE_WITH_AI':'SMART_ANALYZE',`${ticket.key}: ${analysis.proposals.length} candidates`);
    save(s);res.json({analysis});
  }finally{running=false;}
}));
function applySmartProposals(s,ticket,analysis,{reviewed=false,ids=null}={}){
  if(!analysis || analysis.requirementHash!==requirementHash(ticket)||analysis.targetUrl!==s.settings.targetUrl||analysis.environment!==s.settings.environment)
    throw new Error('Analysis is out of date. Re-run Smart Analyze before applying mappings');
  const changes=[];
  for(const item of analysis.proposals){
    if(ids && !ids.includes(item.testId))continue;
    if(item.reviewRequired && !reviewed)continue;
    const tc=(s.tests[ticket.key]||[]).find(x=>x.id===item.testId);if(!tc)continue;
    // Never silently downgrade a tester's custom functional smoke mapping to a heading check.
    if(!reviewed && tc.steps?.length && !['Demo mapping','Auto-discovered structural smoke','Bundled demo fixture, selectors observed'].includes(tc.source))continue;
    const steps=validateSteps(item.steps);
    if(JSON.stringify(tc.steps||[])===JSON.stringify(steps))continue;
    tc.steps=steps;tc.status='NOT_RUN';tc.actual='';tc.screenshot=null;
    tc.source=`${item.origin}${item.reviewRequired?' (locally reviewed)':''}`;
    changes.push(item.testId);
  }
  if(changes.length)revokeSignoffs(s,ticket.key,'Smart browser mappings changed');
  return changes;
}
app.post('/api/tickets/:key/smart-apply',wrap((req,res)=>{
  if(running)throw new Error('Cannot apply mappings during a browser run');
  if(req.body?.confirm!==true)throw new Error('Explicit review confirmation is required');
  const s=load(),ticket=find(s,req.params.key),analysis=s.smartAnalyses?.[ticket.key];
  const ids=req.body?.ids;
  if(!Array.isArray(ids)||!ids.length||ids.some(x=>typeof x!=='string'))throw new Error('Choose mapping candidates to approve');
  const changes=applySmartProposals(s,ticket,analysis,{reviewed:true,ids});
  audit(s,'Local reviewer (unauthenticated)','APPROVE_SMART_MAPPINGS',`${ticket.key}: ${changes.join(',')||'no changes'}`);
  save(s);res.json({changed:changes,notice:'Mapping review is local; execution and PASS assertions still required.'});
}));

async function executeTicket(s,ticket,ids){
  if(!s.tests[ticket.key])s.tests[ticket.key]=draftTests(ticket);
  const runId=id('run');
  const selected=s.tests[ticket.key].filter(t=>!Array.isArray(ids)||ids.includes(t.id));
  if(!selected.length)throw new Error('No tests were selected');
  const results=await execute(selected,s.settings,runId);
  // Changes during the browser run are guarded by the running flag.
  const current=load();revokeSignoffs(current,ticket.key,'New test execution performed');
  for(const result of results){
    const test=(current.tests[ticket.key]||[]).find(t=>t.id===result.testId);
    if(test){test.status=result.status;test.actual=result.actual;test.screenshot=result.screenshot;}
  }
  const ciLink=current.pipeline?.links?.[ticket.key];
  const ciBuild=ciLink?.latest;
  const run={id:runId,key:ticket.key,environment:s.settings.environment,timestamp:new Date().toISOString(),results,ciBuildId:ciBuild?.id||null,ciCommit:ciBuild?.sha||null};
  current.runs.unshift(run);
  for(const result of results)if(result.status==='PASS')for(const d of current.defects){
    if(d.issueKey===ticket.key && d.testId===result.testId && d.status==='FIXED_PENDING_RETEST'){
      d.status='CLOSED';d.retestedAt=new Date().toISOString();
    }
  }
  const failures=results.filter(t=>t.status==='FAIL');
  for(const f of failures){
    const {defect,created}=recordFailure(current,ticket,selected,f);
    if(created && process.env.JIRA_WRITE_ENABLED==='1'){
      try{defect.jiraBugKey=await jira.createBug(ticket,defect);}catch(e){defect.syncError=e.message;}
    }
  }
  if(ciBuild?.status==='completed'&&ciBuild?.conclusion==='success'){pipeline.markRetested(current,ticket.key,ciBuild,run.id);}
  audit(current,'Playwright runner','EXECUTION_COMPLETED',`${ticket.key}: ${results.filter(x=>x.status==='PASS').length} pass, ${failures.length} fail, ${results.filter(x=>x.status==='BLOCKED').length} blocked`);
  save(current);
  return {run,defects:current.defects.filter(d=>d.issueKey===ticket.key)};
}
app.post('/api/tickets/:key/test',wrap(async(req,res)=>{
  if(running)throw new Error('A browser run is already in progress');
  running=true;
  try{const s=load(),ticket=find(s,req.params.key);res.json(await executeTicket(s,ticket,req.body?.ids));}
  finally{running=false;}
}));
// One-click pilot: inspect DOM, auto-map only evidence-grounded safe checks,
// then execute. Unmapped acceptance scenarios are BLOCKED, never implicit PASS.
app.post('/api/tickets/:key/smart-run',wrap(async(req,res)=>{
  if(running)throw new Error('A browser run is already in progress');
  running=true;
  try{
    const s=load(),ticket=find(s,req.params.key);
    if(!s.tests[ticket.key])s.tests[ticket.key]=draftTests(ticket);
    // EDU demo fixtures are only valid against the bundled isolated test site.
    if(ticket.demo){const url=targetUrl(s.settings);if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/sample-app\/?$/.test(url.pathname))throw new Error('Demo ticket requires the bundled target URL http://127.0.0.1:4177/sample-app/ (set it in Project Setup).');}
    const analysis=await smart.analyze(ticket,s.settings,s.tests[ticket.key]);
    s.smartAnalyses ||= {};s.smartAnalyses[ticket.key]=analysis;
    const mapped=applySmartProposals(s,ticket,analysis);
    audit(s,'Browser analyst','SMART_RUN_PLAN',`${ticket.key}: ${mapped.length} new safe mappings; ${analysis.notMapped.length} unmapped`);
    save(s);
    const result=await executeTicket(s,ticket);
    res.json({...result,analysis:{pageTitle:analysis.pageTitle,autoMapped:mapped,notMapped:analysis.notMapped,acceptanceChecks:analysis.acceptanceChecks}});
  }finally{running=false;}
}));
app.post('/api/defects/:id/resolve',wrap((req,res)=>{if(running)throw new Error('Wait for test execution before resolving defects');const s=load();const d=s.defects.find(x=>x.id===req.params.id);if(!d)throw new Error('Defect not found');if(!['OPEN','FIXED_PENDING_RETEST'].includes(d.status))throw new Error('Defect cannot be changed');d.status='FIXED_PENDING_RETEST';audit(s,'Local user','DEFECT_MARKED_FIXED',d.id);save(s);res.json({defect:d});}));

// CI/CD adapter: GitHub Actions read-only status; local mapped QA runs after successful new build.
// An Actions success is NOT a test PASS: only the separate local browser/API/DB runner can set PASS.
app.get('/api/pipeline/status',wrap((req,res)=>res.json({configured:pipeline.configured(),repository:pipeline.repository()?.fullName||null,workflow:process.env.GITHUB_WORKFLOW||null,pollSeconds:Number(process.env.PIPELINE_POLL_SECONDS||0)})));
app.post('/api/pipeline/link',wrap((req,res)=>{
  if(running)throw new Error('Cannot edit CI links during execution');
  if(!pipeline.configured())throw new Error('Configure GitHub Actions in .env first');
  pipeline.workflowName();
  const s=load(),ticket=find(s,req.body?.key);
  const result=pipeline.linkTicket(s,ticket.key,req.body?.branch);
  if(result.changed){invalidateResults(s,ticket.key,'CI branch linkage changed');audit(s,'Local user','CI_BRANCH_LINKED',`${ticket.key}: ${result.link.branch}`);save(s);}
  res.json({link:result.link,changed:result.changed});
}));
async function checkPipelineForTicket(key,{retry=false}={}){
  // Caller owns the global `running` lock, including the outbound check and subsequent retest.
  const s=load(),ticket=find(s,key),link=s.pipeline?.links?.[key];
  if(!link)throw new Error('Link this Jira ticket to a GitHub branch first');
  const build=await pipeline.latest(link.branch);
  const observed=pipeline.updateObservation(s,key,build);
  if(observed.changed){
    invalidateResults(s,key,'CI run or build status changed');
    audit(s,'GitHub Actions','CI_BUILD_OBSERVED',`${key}: ${build?.id||'none'} ${build?.status||'not_found'} / ${build?.conclusion||'unknown'}`);
  }
  save(s);
  // No duplicate test run for same unchanged successful build.
  if(!observed.changed && !(retry && build?.status==='completed' && build?.conclusion==='success' && !observed.link.retestRunId))return {build,changed:false,retested:false,reason:observed.link.retestError?'Prior retest errored; use Check build & retest to retry.':'Already checked this build. No duplicate retest.'};
  if(!build||build.status!=='completed'||build.conclusion!=='success')return {build,changed:true,retested:false,reason:'Build not successful. QA retest not started.'};
  if(s.settings.environment==='PROD')return {build,changed:true,retested:false,reason:'Production auto-retest is prohibited.'};
  try{
    const result=await executeTicket(s,ticket);
    const current=load();pipeline.markRetested(current,key,build,result.run.id);
    audit(current,'CI/CD coordinator','CI_AUTO_RETEST',`${key} build ${build.id} -> local run ${result.run.id}`);save(current);
    return {build,changed:true,retested:true,run:result.run};
  }catch(err){
    const current=load();const currentLink=current.pipeline?.links?.[key];
    if(currentLink){currentLink.retestError=String(err.message).slice(0,300);audit(current,'CI/CD coordinator','CI_RETEST_ERROR',`${key}: ${currentLink.retestError}`);save(current);}
    return {build,changed:true,retested:false,reason:`Retest could not complete: ${err.message}`};
  }
}
app.post('/api/pipeline/check',wrap(async(req,res)=>{
  if(running)throw new Error('Another test run or build check is in progress');
  if(!pipeline.configured())throw new Error('Configure GitHub Actions first');
  running=true;
  try{const key=String(req.body?.key||'').trim();res.json(await checkPipelineForTicket(key,{retry:true}));}
  finally{running=false;}
}));

app.post('/api/tickets/:key/signoff',wrap((req,res)=>{
  if(running)throw new Error('Cannot sign off during a running test');
  const s=load(),t=find(s,req.params.key);
  const check=readiness(s,t.key);
  if(!check.eligible)throw new Error(`Sign-off blocked: ${check.reasons.join('; ')}`);
  const approver=String(req.body.approver||'').trim();if(approver.length<3)throw new Error('Approver name is required');
  const rec={id:id('signoff'),issueKey:t.key,approver,when:new Date().toISOString(),note:'Local, unauthenticated attestation only; does NOT update Jira workflow or prove approver identity.'};s.signoffs.unshift(rec);audit(s,approver,'SIGNOFF_DEMO',t.key);save(s);res.json({signoff:rec});
}));
app.post('/api/developer/propose',wrap(async(req,res)=>{
  const s=load(),ticket=find(s,req.body.key);
  const artifact=await propose(ticket,req.body.language||'TypeScript');
  audit(s,'Local user','CODE_PROPOSAL',`${ticket.key}: ${artifact.language} (${artifact.mode})`);save(s);res.json(artifact);
}));
app.get('/api/export/:key',wrap(async(req,res)=>{const s=load();const wb=await workbookFor(s,req.params.key);res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="QASphere_${req.params.key}_Test_Report.xlsx"`);await wb.xlsx.write(res);res.end();}));
app.get('/api/audit',wrap((req,res)=>res.json(load().audit.slice(0,100))));
app.listen(PORT,'127.0.0.1',()=>{console.log(`\nQASphere AI running: http://127.0.0.1:${PORT}\nLocal demonstration only (no authentication; do not expose to internet).\n`);});
const interval=Number(process.env.JIRA_POLL_SECONDS||0);
if(jira.configured()&&interval>=60&&(process.env.JIRA_SYNC_MODE==='assigned'||process.env.JIRA_BOARD_ID)){
  let syncing=false;
  setInterval(async()=>{if(syncing||running)return;syncing=true;try{if(process.env.JIRA_SYNC_MODE==='assigned'){const issues=await jira.getAssignedIssues();const s=load();for(const issue of issues){const change=upsertIssue(s,issue);if(change.changed){s.smartAnalyses ||= {};delete s.smartAnalyses[issue.key];}if(!s.tests[issue.key])s.tests[issue.key]=draftTests(issue);}audit(s,'Jira polling','SYNC_ASSIGNED',`${issues.length} assigned issues`);save(s);}else{const sid=await jira.getActiveSprintId(process.env.JIRA_BOARD_ID);if(sid)await syncSprint(sid);}}catch(e){console.error('Jira polling:',e.message);}finally{syncing=false;}},interval*1000).unref();
}

// Poll only linked tickets; no GitHub write, deployment, or workflow dispatch.
const pipelineInterval=Number(process.env.PIPELINE_POLL_SECONDS||0);
if(pipeline.configured() && process.env.GITHUB_WORKFLOW && Number.isSafeInteger(pipelineInterval) && pipelineInterval>=60){
  setInterval(async()=>{
    if(running)return;
    running=true;
    try{
      const links=Object.keys(load().pipeline?.links||{});
      for(const key of links){try{await checkPipelineForTicket(key);}catch(err){console.error(`CI sync ${key}:`,err.message);}}
    }finally{running=false;}
  },pipelineInterval*1000).unref();
}
