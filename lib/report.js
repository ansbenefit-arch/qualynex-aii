const ExcelJS=require('exceljs');
function protect(value){
  // Keep imported Jira text as plain text, never as a spreadsheet formula.
  if(typeof value==='string' && /^[\s]*[=+\-@]/.test(value))return `'${value}`;
  return value??'';
}
function addSheet(wb,name,columns,rows){
  const ws=wb.addWorksheet(name);
  ws.columns=columns.map(([header,key,width])=>({header,key,width}));
  for(const row of rows){
    const safe=Object.fromEntries(columns.map(([,key])=>[key,protect(row[key])]));
    ws.addRow(safe);
  }
  ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF172554'}};
  ws.views=[{state:'frozen',ySplit:1}];
  ws.autoFilter={from:{row:1,column:1},to:{row:Math.max(ws.rowCount,1),column:columns.length}};
  for(let n=2;n<=ws.rowCount;n++)ws.getRow(n).alignment={vertical:'top',wrapText:true};
  return ws;
}
async function workbookFor(state,key){
  const issue=state.tickets.find(t=>t.key===key);if(!issue)throw new Error('Ticket not found');
  const wb=new ExcelJS.Workbook();wb.creator='QASphere AI v0.6';
  const tests=state.tests[key]||[];
  const ws=addSheet(wb,'Test Cases',[
    ['Test ID','id',24],['Category','type',20],['Scenario','title',55],['Expected','expected',75],
    ['Status','status',18],['Actual','actual',75],['Source','source',36],['Execution Steps','stepSummary',72],['Evidence','screenshot',52]
  ],tests.map(x=>({...x,stepSummary:JSON.stringify(x.steps||[])})));
  for(let n=2;n<=ws.rowCount;n++){
    const cell=ws.getCell(`E${n}`);const st=cell.value;
    cell.font={bold:true,color:{argb:st==='PASS'?'FF15803D':st==='FAIL'?'FFB91C1C':'FF64748B'}};
  }
  addSheet(wb,'Issue Overview',[['Field','field',26],['Value','value',110]],[
    ['Ticket key',issue.key],['Summary',issue.summary],['Description',issue.description],
    ['Acceptance criteria',issue.acceptanceCriteria],['Sprint',issue.sprint],['Jira status',issue.status],
    ['Assignee',issue.assignee],['Environment',state.settings.environment],['Test target URL',state.settings.targetUrl],
    ['DB connected','No - unimplemented'],['Last run',state.runs.find(r=>r.key===key)?.timestamp||'Never']
  ].map(([field,value])=>({field,value})));
  addSheet(wb,'Run History',[
    ['Run ID','runId',24],['Timestamp','timestamp',28],['Environment','environment',16],
    ['Test ID','testId',26],['Result','status',18],['Actual','actual',80],['Screenshot URL','screenshot',56]
  ],state.runs.filter(r=>r.key===key).flatMap(r=>r.results.map(x=>({...x,runId:r.id,timestamp:r.timestamp,environment:r.environment}))));
  addSheet(wb,'Defects',[
    ['Bug ID','id',24],['Test ID','testId',26],['Title','title',60],['Status','status',24],
    ['Owner','owner',28],['Jira Bug','jiraBugKey',24],['Message','message',90],['Created','createdAt',30]
  ],state.defects.filter(d=>d.issueKey===key));
  const smart=state.smartAnalyses?.[key];
  addSheet(wb,'Smart Analysis',[
    ['Candidate Test ID','testId',28],['Origin','origin',46],['Confidence','confidence',22],
    ['Needs Review','reviewRequired',20],['Scope / rationale','scope',86],['Proposed Steps','stepsSummary',88]
  ],(smart?.proposals||[]).map(p=>({...p,reviewRequired:p.reviewRequired?'YES':'NO',stepsSummary:JSON.stringify(p.steps||[])})));
  addSheet(wb,'Acceptance Checks',[
    ['AC ID','id',16],['Requirement','criterion',110]
  ],smart?.acceptanceChecks||[]);
  const ciLink=state.pipeline?.links?.[key];
  addSheet(wb,'CI-CD Build',[['Field','field',30],['Value','value',96]],[
    ['Repository',process.env.GITHUB_REPOSITORY||'Not connected'],['Workflow',process.env.GITHUB_WORKFLOW||'Not configured'],
    ['Ticket branch',ciLink?.branch||'Not linked'],['GitHub run',ciLink?.latest?.id||'Not verified'],
    ['Build status',ciLink?.latest?.status||'Not verified'],['Build conclusion',ciLink?.latest?.conclusion||'Not verified'],
    ['Commit SHA',ciLink?.latest?.sha||''],['Actions run URL',ciLink?.latest?.url||''],
    ['Last checked',ciLink?.latest?.checkedAt||''],['Linked QA retest run',ciLink?.retestRunId||'Not yet executed'],
    ['Retest error',ciLink?.retestError||'']
  ].map(([field,value])=>({field,value})));
  addSheet(wb,'Signoffs',[
    ['Sign-off ID','id',24],['Approver (unverified)','approver',35],['Signed at','when',30],
    ['Revoked at','revokedAt',30],['Reason','revokedReason',65],['Note','note',90]
  ],state.signoffs.filter(a=>a.issueKey===key));
  return wb;
}
module.exports={workbookFor};
