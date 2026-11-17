// Pure browser-planning functions, deliberately separate from Playwright IO.
const {validateSteps}=require('./workflow');
const {demoSteps}=require('./generate');
function acceptanceChecks(ticket){
  const content=String(ticket.acceptanceCriteria||'').trim();
  if(!content)return [];
  // Sentence-oriented decomposition for readable traceability; not an LLM assessment.
  return content.split(/(?<=\.)\s+(?=(?:Given|When|Then|And|But)\b)|\n+|(?<=\.)\s+(?=[A-Z])/i)
    .map(x=>x.trim()).filter(Boolean).slice(0,25).map((criterion,index)=>({id:`AC-${String(index+1).padStart(2,'0')}`,criterion}));
}
function fromSnapshot(ticket,tests,snapshot,base){
  const proposals=[];const h=snapshot.elements.find(x=>['h1','h2'].includes(x.tag)&&x.visible&&x.text&&x.selector);
  const smoke=tests.find(t=>t.type==='Smoke');
  if(smoke&&h)proposals.push({testId:smoke.id,type:'Smoke',origin:'DOM structural smoke',confidence:'high',reviewRequired:false,
    scope:'Only verifies the observed heading on the current URL; not business acceptance criteria',
    steps:validateSteps([{action:'goto'},{action:'assertVisible',selector:h.selector},{action:'assertText',selector:h.selector,value:h.text}])});
  // Only the bundled demo is automatically mapped for business interactions.
  // Checking selectors against the visited DOM prevents mapping the wrong page by accident.
  const demoTarget=['localhost','127.0.0.1'].includes(base.hostname)&&/^\/sample-app\/?$/.test(base.pathname);
  const present=new Set(snapshot.elements.map(x=>x.selector).filter(Boolean));
  if(ticket.demo && demoTarget){
    for(const tc of tests){
      if(proposals.some(p=>p.testId===tc.id))continue;
      const steps=demoSteps(ticket.key,tc.type);
      if(!steps.length||steps.some(st=>st.selector&&!present.has(st.selector)))continue;
      proposals.push({testId:tc.id,type:tc.type,origin:'Bundled demo fixture, selectors observed',confidence:'high',reviewRequired:false,
        scope:'Demo Education Portal ONLY; not a production or Jira application',steps:validateSteps(steps)});
    }
  }
  return proposals;
}

module.exports={acceptanceChecks,fromSnapshot};
