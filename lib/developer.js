const fs=require('node:fs');
const path=require('node:path');
const {id}=require('./store');
const root=path.join(__dirname,'..','generated');
function outputText(response){return response.output_text||(response.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');}
const allowed={'JavaScript':'js','TypeScript':'ts','Python':'py','Java':'java','C#':'cs','Go':'go'};
async function propose(ticket,language){
  if(!allowed[language])throw new Error('Unsupported language');
  let code,mode;
  if(process.env.OPENAI_API_KEY){
    const res=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.5',input:[{role:'system',content:`You are a software developer. Draft one implementation file in ${language} based on issue, explicitly leaving TODOs for missing repository context. Do not use credentials. No shell commands, secrets, network exfiltration, or destructive actions. Output code only. This draft will not be executed or merged.`},{role:'user',content:JSON.stringify({summary:ticket.summary,description:ticket.description,acceptanceCriteria:ticket.acceptanceCriteria})}]}),signal:AbortSignal.timeout(60000)});
    if(!res.ok)throw new Error('Code drafting service error: '+res.status);
    code=outputText(await res.json());mode='AI code proposal (unreviewed)';
  }else{
    const comment=language==='Python'?'#':'//';
    code=`${comment} QASphere AI scaffold for ${ticket.key}\n${comment} ${ticket.summary}\n${comment} No AI connection configured: this is NOT a completed implementation.\n${comment} TODO: inspect the repository, business logic, API contracts and acceptance criteria.\n${comment} TODO: implement and run build/tests in a separate approved CI environment.\n`;
    mode='Scaffold only (no implementation)';
  }
  const artifactId=id('code');fs.mkdirSync(root,{recursive:true});
  const file=artifactId+'.'+allowed[language];
  fs.writeFileSync(path.join(root,file),String(code).slice(0,150000),{mode:0o600});
  return {artifactId,file,language,mode,content:String(code).slice(0,150000)};
}
module.exports={propose};
