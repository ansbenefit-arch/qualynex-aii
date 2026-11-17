const TYPES=[
  ['Smoke','Can the linked application load and show a usable page?'],
  ['Positive','Do the main acceptance criteria succeed for valid input?'],
  ['Negative','Are invalid, missing and unauthorized requests rejected?'],
  ['Boundary','Do input values at minimum/maximum boundaries behave correctly?'],
  ['Regression','Do surrounding workflows continue to work after the change?'],
  ['Integration','Do this feature and dependent services agree on data and state?'],
  ['End-to-End','Can a complete realistic user journey succeed?'],
  ['API','Do REST/GraphQL responses, auth and error codes meet the contract?'],
  ['Database','Do read/write operations preserve correct schema, integrity and isolation?'],
  ['Security','Are authentication, authorization and data exposure protections correct?'],
  ['Accessibility','Can keyboard and assistive-technology users complete the workflow?'],
  ['Performance','Does the workflow meet defined latency and capacity thresholds?'],
  ['Compatibility','Does the feature work on supported devices/browsers?'],
  ['SIT/UAT','Can integrated stakeholders accept the documented business outcome?']
];
function demoSteps(key,type) {
  if(!['EDU-101','EDU-102'].includes(key))return [];
  const goto={action:'goto'};
  if(key==='EDU-102'){
    const blocked={action:'goto',url:'?blocked=1'};
    if(type==='Smoke')return [blocked,{action:'assertVisible',selector:'#app-heading'}];
    if(type==='Negative')return [blocked,{action:'assertDisabled',selector:'#schedule'}];
    if(type==='Regression')return [goto,{action:'assertEnabled',selector:'#schedule'}];
    return [];
  }
  if(type==='Smoke')return [goto,{action:'assertVisible',selector:'#app-heading'}];
  if(type==='Positive')return [goto,{action:'click',selector:'#schedule'},{action:'fill',selector:'#studentName',value:'Alex'},{action:'fill',selector:'#date',value:'2026-12-01'},{action:'click',selector:'#book'},{action:'assertVisible',selector:'#success'}];
  if(type==='Negative')return [goto,{action:'click',selector:'#schedule'},{action:'click',selector:'#book'},{action:'assertVisible',selector:'#error'}];
  if(type==='Regression')return [goto,{action:'click',selector:'#schedule'},{action:'click',selector:'#cancel'},{action:'assertHidden',selector:'#booking'},{action:'assertVisible',selector:'#app-heading'}];
  return [];
}
function draftTests(ticket) {
  return TYPES.map(([type,objective],i)=>({id:`${ticket.key}-TC-${String(i+1).padStart(2,'0')}`,type,title:`${type}: ${ticket.summary}`,objective,expected:type==='Smoke'?'Application loads and primary page is visible.':`Verify ${objective.toLowerCase()} against: ${(ticket.acceptanceCriteria||ticket.description||ticket.summary).slice(0,280)}`,source:ticket.demo?'Demo mapping':'Template - review required',steps:demoSteps(ticket.key,type),status:'NOT_RUN',actual:''}));
}
function extractResponseText(result) {
  if(result.output_text)return result.output_text;
  return (result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
}
async function aiEnrich(ticket, tests) {
  if(!process.env.OPENAI_API_KEY)return tests;
  const schema={type:'object',additionalProperties:false,properties:{scenarios:{type:'array',items:{type:'object',additionalProperties:false,properties:{category:{type:'string'},title:{type:'string'},expected:{type:'string'}},required:['category','title','expected']}}},required:['scenarios']};
  const resp=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.5',input:[{role:'system',content:'You are a senior QA engineer. Based on the issue, write specific, grounded test scenarios. Never claim a scenario was executed. Output JSON only. Include positive, negative, boundary, smoke, regression, integration, E2E, API, database, and security when relevant.'},{role:'user',content:JSON.stringify({summary:ticket.summary,description:ticket.description,acceptanceCriteria:ticket.acceptanceCriteria})}],text:{format:{type:'json_schema',name:'qa_scenarios',strict:true,schema}}}),signal:AbortSignal.timeout(60000)});
  if(!resp.ok)throw new Error(`AI draft failed: HTTP ${resp.status}`);
  const data=JSON.parse(extractResponseText(await resp.json()));
  const allowed=new Set(TYPES.map(t=>t[0]));
  // Only replace non-executable drafts; do not replace validated demo steps.
  let index=tests.length;
  for(const item of (data.scenarios||[]).slice(0,30)){
    if(!allowed.has(item.category))continue;
    tests.push({id:`${ticket.key}-AI-${String(++index).padStart(2,'0')}`,type:item.category,title:String(item.title).slice(0,180),objective:'AI proposed scenario (requires selector/data mapping before execution)',expected:String(item.expected).slice(0,1500),source:'AI draft - not executable',steps:[],status:'NOT_RUN',actual:''});
  }
  return tests;
}
module.exports={TYPES,draftTests,aiEnrich,demoSteps};
