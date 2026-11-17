const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const FILE = path.join(__dirname, '..', 'data', 'state.json');
function sample() {
  return {
    settings: {organization:'Demo Organization', project:'Education Portal', domain:'Education', workspace:'Tester', testerMode:'Manual Tester', database:'Microsoft SQL Server', dbConnected:false, jiraConnected:false, environment:'DEV', targetUrl:process.env.TEST_TARGET_URL || 'http://127.0.0.1:4177/sample-app'},
    tickets: [
      {key:'EDU-101', summary:'Guardian can schedule a new session', description:'Guardian can open session booking and submit a student name and selected date. Empty student name must be rejected.', acceptanceCriteria:'Given an authorized guardian on dashboard, When booking a valid session, Then a confirmation message appears. Given no student name, Then an actionable validation error appears.', status:'Ready for QA', assignee:'Demo Tester', sprint:'Sprint 262', demo:true, updatedAt:new Date().toISOString()},
      {key:'EDU-102', summary:'Block scheduling when enrollment is restricted', description:'When scheduling is blocked, guardian should not be able to create an appointment.', acceptanceCriteria:'Schedule control is disabled; booking endpoint also rejects restricted enrollment requests.', status:'In Development', assignee:'Demo Developer', sprint:'Sprint 262', demo:true, updatedAt:new Date().toISOString()}
    ], tests:{}, runs:[], defects:[], signoffs:[], audit:[]
  };
}
function load() { try { return JSON.parse(fs.readFileSync(FILE,'utf8')); } catch(e) { if(e.code !== 'ENOENT') throw e; const s=sample(); save(s); return s; } }
function save(s) { fs.mkdirSync(path.dirname(FILE),{recursive:true}); const tmp=FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(s,null,2),{mode:0o600}); fs.renameSync(tmp,FILE); }
function id(prefix='id') { return `${prefix}-${crypto.randomUUID().slice(0,8)}`; }
function audit(s, actor, action, detail) { s.audit.unshift({id:id('audit'), timestamp:new Date().toISOString(), actor,action,detail}); s.audit=s.audit.slice(0,500); }
module.exports={load,save,id,audit};
