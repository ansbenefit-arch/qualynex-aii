const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../lib/db-check');
const {validateSteps}=require('../lib/workflow');
const env={SQLSERVER_HOST:'test-db.local',SQLSERVER_DATABASE:'TestDB',SQLSERVER_USER:'read_only',SQLSERVER_PASSWORD:'secret'};

test('catalog contains only approved check identifiers and descriptions, never SQL/passwords',()=>{
 const cat=db.catalog({});
 assert.equal(cat.configured,false);
 assert.equal(cat.checks.length,1);
 assert.equal(cat.checks[0].id,'sql-connectivity');
 assert.deepEqual(cat.checks[0].params,[]);
 assert.equal(JSON.stringify(cat).includes('SELECT CAST'),false);
});
test('rejects writes, comments, stacked SQL, dynamic commands and misdeclared parameters',()=>{
 const dangerous=['DELETE FROM Bookings','SELECT 1; DROP TABLE Bookings','SELECT 1 --comment','SELECT * INTO NewTable FROM OldTable','SELECT * FROM OPENROWSET(x)','SELECT 1 /*comment*/'];
 for(const sql of dangerous)assert.throws(()=>db.validateReadOnly(sql));
 assert.equal(db.validateReadOnly(' SELECT CAST(1 AS int) AS ok;'),'SELECT CAST(1 AS int) AS ok');
 assert.throws(()=>db.validateCheck({id:'booking-check',description:'test',sql:'SELECT 1',params:['id']}),/Declared DB parameter/);
 assert.throws(()=>db.safeParams({studentName:'a',secret:'b'},['studentName']),/Exactly/);
 assert.throws(()=>db.safeParams({},['studentName']),/Exactly/);
});
test('SQL mapping requires a real assertion, approved check ID and bounded parameter values',()=>{
 const mapped=[{action:'dbQuery',checkId:'sql-connectivity',params:{}},{action:'assertDbValue',selector:'connected',value:'1'}];
 assert.deepEqual(validateSteps(mapped),mapped);
 assert.throws(()=>validateSteps([mapped[0]]),/assertion/);
 assert.throws(()=>validateSteps([mapped[1]]),/First step/);
 assert.throws(()=>validateSteps([{...mapped[0],checkId:'../secrets'},mapped[1]]),/check ID/);
 assert.throws(()=>validateSteps([{...mapped[0],params:{studentName:'x'.repeat(301)}},mapped[1]]),/DB parameter/);
 assert.throws(()=>validateSteps([{action:'dbQuery',checkId:'sql-connectivity',params:{}},{action:'assertApiJson',selector:'ok',value:'1'}]),/API assertion/);
});
test('SQL connectivity and parameterized allowlisted check work with fake driver (no live DB)',async()=>{
 const log=[];
 class FakePool{
  constructor(config){assert.equal(config.options.encrypt,true);assert.equal(config.options.trustServerCertificate,false);assert.equal(config.user,'read_only');}
  async connect(){log.push('connect');}
  request(){return {input(name,value){log.push(['param',name,value]);return this;},async query(sql){log.push(['query',sql]);return {recordset:[sql.includes(' AS connected')?{connected:1}:{ok:1}]};}};}
  async close(){log.push('close');}
 }
 const fakeDriver={ConnectionPool:FakePool};
 const result=await db.checkConnection({env,sqlDriver:fakeDriver});
 assert.equal(result.connected,true);
 assert.equal(result.database,'TestDB');
 const row=await db.runCheck({action:'dbQuery',checkId:'sql-connectivity',params:{}},{env,sqlDriver:fakeDriver});
 db.assertDb({action:'assertDbValue',selector:'connected',value:'1'},row);
 assert.throws(()=>db.assertDb({action:'assertDbValue',selector:'connected',value:'0'},row),/sensitive database values withheld/);
 assert.equal(log.filter(x=>x==='close').length,2);
 assert.deepEqual(log.filter(x=>Array.isArray(x)&&x[0]==='query').map(x=>x[1]),['SELECT CAST(1 AS int) AS ok','SELECT CAST(1 AS int) AS connected']);
});
test('unconfigured connection is BLOCKED and reject TLS trust bypass',()=>{
 assert.throws(()=>db.sqlConfig({}),db.DatabaseUnavailable);
 assert.throws(()=>db.sqlConfig({...env,SQLSERVER_TRUST_SERVER_CERTIFICATE:'1'}),/disabled/);
 assert.throws(()=>db.configFile?.({...env,SQLSERVER_CHECKS_FILE:'../../private.json'}),/inside the project folder/);
});
