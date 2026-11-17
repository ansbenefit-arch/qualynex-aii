const BASE=()=>process.env.JIRA_BASE_URL?.replace(/\/$/,'');
function configured() {return Boolean(BASE() && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);}
function issueKey(input) {
  const raw=String(input || '').trim();
  if (/^[A-Z][A-Z0-9_]*-\d+$/i.test(raw)) return raw.toUpperCase();
  let u;try {u=new URL(raw);}catch {throw new Error('Enter a Jira issue key or a valid Jira issue URL.');}
  if(!['https:'].includes(u.protocol)) throw new Error('Only HTTPS Jira links are permitted.');
  if(!configured()) throw new Error('Configure Jira .env before importing Jira URLs.');
  const base=new URL(BASE());
  if(u.origin!==base.origin) throw new Error('Jira URL must match the configured Jira site.');
  const match=u.pathname.match(/\/browse\/([A-Z][A-Z0-9_]*-\d+)/i);
  if (!match) throw new Error('URL must be a Jira /browse/ISSUE-123 link.');
  return match[1].toUpperCase();
}
function flatten(node) {
  if (node==null) return '';
  if (typeof node==='string') return node;
  if (Array.isArray(node)) return node.map(flatten).join('');
  const text=node.text || '';
  const children=flatten(node.content || []);
  const sep=['paragraph','heading','listItem'].includes(node.type)?'\n':'';
  return text+children+sep;
}
async function request(endpoint, options={}) {
  if(!configured()) throw new Error('Jira is not configured in .env');
  let configuredSite;try{configuredSite=new URL(BASE());}catch{throw new Error('JIRA_BASE_URL is invalid');}
  if(configuredSite.protocol!=='https:'||configuredSite.username||configuredSite.password)throw new Error('Jira Cloud requires an HTTPS base URL without embedded credentials');
  const auth=Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  const res=await fetch(`${BASE()}${endpoint}`,{...options,headers:{Authorization:`Basic ${auth}`,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})},signal:AbortSignal.timeout(15000)});
  if(!res.ok) {const body=(await res.text()).slice(0,400); throw new Error(`Jira HTTP ${res.status}: ${body}`);}
  if(res.status===204)return {};
  return res.json();
}
function normalize(issue,sprintName) {
  const f=issue.fields || {};
  const configuredAC=process.env.JIRA_ACCEPTANCE_FIELD?f[process.env.JIRA_ACCEPTANCE_FIELD]:null;
  const ac=configuredAC||Object.keys(f).filter(k=>/^customfield_/.test(k)).map(k=>f[k]).find(v=>typeof v==='string'&&/given|when|then|acceptance criteria/i.test(v));
  return {key:issue.key, summary:f.summary||'',description:flatten(f.description).trim(),acceptanceCriteria:flatten(ac).trim(),status:f.status?.name||'Unknown',assignee:f.assignee?.displayName||'Unassigned',assigneeId:f.assignee?.accountId||null,sprint:sprintName||f.sprint?.name||'Unassigned sprint',demo:false, updatedAt:f.updated||new Date().toISOString()};
}
async function getIssue(key) {return normalize(await request(`/rest/api/3/issue/${encodeURIComponent(key)}`));}
async function getSprintIssues(sprintId) {
  if(!/^\d+$/.test(String(sprintId))) throw new Error('Sprint ID must be numeric');
  const sprint=await request(`/rest/agile/1.0/sprint/${sprintId}`);
  const out=[];let startAt=0;let pages=0;
  while(pages<10 && out.length<500) {
    // Jira Agile sprint-issue endpoint uses startAt/maxResults, not nextPageToken.
    const q=new URLSearchParams({maxResults:'50',startAt:String(startAt)});
    const response=await request(`/rest/agile/1.0/sprint/${sprintId}/issue?${q}`);
    const items=response.issues||[];
    out.push(...items.map(x=>normalize(x,sprint.name)));
    pages++;
    if(!items.length || response.isLast || (response.total!==undefined && startAt+items.length>=response.total))break;
    startAt+=items.length;
  }
  return out.slice(0,500);
}
// Jira Cloud enhanced JQL search uses POST + nextPageToken, not startAt.
async function getAssignedIssues(){
  const out=[];let nextPageToken;let pages=0;
  const fields=['summary','description','status','assignee','updated'];
  if(process.env.JIRA_ACCEPTANCE_FIELD)fields.push(process.env.JIRA_ACCEPTANCE_FIELD);
  while(pages<10&&out.length<500){
    const payload={jql:'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC',maxResults:50,fields};
    if(nextPageToken)payload.nextPageToken=nextPageToken;
    const result=await request('/rest/api/3/search/jql',{method:'POST',body:JSON.stringify(payload)});
    const issues=result.issues||[];
    out.push(...issues.map(i=>normalize(i)));
    pages++;
    if(result.isLast||!result.nextPageToken||!issues.length)break;
    nextPageToken=result.nextPageToken;
  }
  return out.slice(0,500);
}
async function getActiveSprintId(boardId) {
  if(!/^\d+$/.test(String(boardId))) throw new Error('Board ID must be numeric');
  const result=await request(`/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=50`);
  return result.values?.[0]?.id||null;
}
async function checkConnection() {
  const self=await request('/rest/api/3/myself');
  return {ok:true,displayName:self.displayName||self.accountId||'Connected',accountId:self.accountId||null};
}
async function createBug(issue,defect) {
  if(process.env.JIRA_WRITE_ENABLED!=='1')return null;
  if(!process.env.JIRA_BUG_PROJECT_KEY)throw new Error('JIRA_BUG_PROJECT_KEY is required for Jira writes.');
  const payload={fields:{project:{key:process.env.JIRA_BUG_PROJECT_KEY},issuetype:{name:'Bug'},summary:`[QASphere] ${issue.key}: ${defect.title}`.slice(0,255),description:{type:'doc',version:1,content:[{type:'paragraph',content:[{type:'text',text:`Found in ${issue.key}. Test: ${defect.testId}. Error: ${defect.message.slice(0,1000)}` }]}]}}};
  const result=await request('/rest/api/3/issue',{method:'POST',body:JSON.stringify(payload)});
  return result.key;
}
module.exports={configured,issueKey,flatten,getIssue,getSprintIssues,getAssignedIssues,getActiveSprintId,createBug,checkConnection};
