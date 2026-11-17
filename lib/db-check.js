// QASphere SQL Server pilot: no ad-hoc SQL from HTTP or Jira tickets.
// Queries are allowlisted in a trusted local config file and parameterized.
// A SQL login with SELECT-only permissions is mandatory; regex checks are not a sandbox.
const fs=require('node:fs');
const path=require('node:path');
const {readPath}=require('./api-check');
class DatabaseUnavailable extends Error { constructor(message){super(message);this.name='DatabaseUnavailable';this.status=503;} }
const IDENT=/^[A-Za-z][\w-]{1,63}$/;
const PARAM=/^[A-Za-z][\w]{0,63}$/;
function configured(env=process.env){return ['SQLSERVER_HOST','SQLSERVER_DATABASE','SQLSERVER_USER','SQLSERVER_PASSWORD'].every(x=>Boolean(env[x]));}
function driverInstalled(){try{require.resolve('mssql');return true;}catch{return false;}}
function sqlConfig(env=process.env){
 if(!configured(env))throw new DatabaseUnavailable('SQL Server is not configured. Set SQLSERVER_HOST, DATABASE, USER and PASSWORD in .env.');
 if(env.SQLSERVER_TRUST_SERVER_CERTIFICATE==='1')throw new DatabaseUnavailable('TrustServerCertificate=1 is disabled by this pilot. Configure a trusted server certificate.');
 const port=Number(env.SQLSERVER_PORT||1433);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid SQLSERVER_PORT');
 return {server:env.SQLSERVER_HOST,port,database:env.SQLSERVER_DATABASE,user:env.SQLSERVER_USER,password:env.SQLSERVER_PASSWORD,options:{encrypt:true,trustServerCertificate:false},connectionTimeout:10000,requestTimeout:10000,pool:{min:0,max:1,idleTimeoutMillis:5000}};
}
function validateReadOnly(sql){
 if(typeof sql!=='string'||sql.length>4000||!/^\s*SELECT\s+/i.test(sql))throw new Error('Checks must be bounded SELECT queries');
 // Only one SELECT statement; reject comments, second statements, and obvious writes.
 // This is defense-in-depth, NOT SQL isolation: enforce SELECT permission in SQL Server.
 const clean=sql.trim().replace(/;\s*$/,'');
 if(/;|--|\/\*|\*\/|\b(?:INTO|INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|OPENROWSET|OPENQUERY|WAITFOR|BACKUP|RESTORE|GRANT|REVOKE|DENY|DBCC)\b/i.test(clean))throw new Error('Unsafe SQL syntax in approved check');
 return clean;
}
function validateCheck(raw){
 if(!raw||typeof raw!=='object'||!IDENT.test(raw.id||''))throw new Error('Invalid database check ID');
 if(typeof raw.description!=='string'||raw.description.length>240)throw new Error('Database check needs a short description');
 const sql=validateReadOnly(raw.sql);
 const params=raw.params||[];
 if(!Array.isArray(params)||params.length>12||new Set(params).size!==params.length||params.some(x=>typeof x!=='string'||!PARAM.test(x)))throw new Error('Invalid DB parameter names');
 for(const param of params)if(!new RegExp('\\@'+param+'\\b').test(sql))throw new Error('Declared DB parameter not present in query: '+param);
 return {id:raw.id,description:raw.description,sql,params};
}
function configFile(env=process.env){
 const root=path.resolve(__dirname,'..');
 const rel=env.SQLSERVER_CHECKS_FILE||'config/db-checks.json';
 const full=path.resolve(root,rel);
 if(!full.startsWith(root+path.sep))throw new Error('SQL check config must be inside the project folder');
 return full;
}
function loadChecks(env=process.env){
 let raw;try{raw=JSON.parse(fs.readFileSync(configFile(env),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw new Error('Cannot load SQL checks: '+e.message);}
 if(!raw||!Array.isArray(raw.checks)||raw.checks.length>50)throw new Error('SQL check config must contain checks array (up to 50)');
 const checks=raw.checks.map(validateCheck);
 if(new Set(checks.map(x=>x.id)).size!==checks.length)throw new Error('Duplicate SQL check IDs');
 return checks;
}
function catalog(env=process.env){return {configured:configured(env),driverInstalled:driverInstalled(),checks:loadChecks(env).map(({id,description,params})=>({id,description,params})),note:'Checks use approved local SELECT queries and a database account with SELECT-only permissions. Configured is not connected.'};}
function safeParams(params,allowed){
 if(!params||typeof params!=='object'||Array.isArray(params))throw new Error('Database parameters must be an object');
 const keys=Object.keys(params);
 if(keys.length!==allowed.length||keys.some(x=>!allowed.includes(x)))throw new Error('Exactly the allowlisted database parameters are required');
 for(const key of keys){const value=params[key];if(!(typeof value==='string'||typeof value==='number'||typeof value==='boolean'||value===null)||String(value).length>300)throw new Error('Database parameter must be a short scalar');}
 return params;
}
function driver(){try{return require('mssql');}catch{throw new DatabaseUnavailable('SQL Server driver not installed. Run npm install, then restart the server.');}}
async function withConnection(fn,{env=process.env,sqlDriver=driver()}={}){
 const config=sqlConfig(env);
 const pool=new sqlDriver.ConnectionPool(config);
 try{await pool.connect();return await fn(pool,sqlDriver);}catch(e){if(e instanceof DatabaseUnavailable)throw e;throw new DatabaseUnavailable('SQL Server connection/query unavailable. Check network, TLS certificate and read-only account. '+String(e.code||'').slice(0,30));}
 finally{await pool.close().catch(()=>{});}
}
async function checkConnection(opts={}){
 return withConnection(async pool=>{
  const result=await pool.request().query('SELECT CAST(1 AS int) AS ok');
  if(result.recordset?.[0]?.ok!==1)throw new DatabaseUnavailable('Connection validation did not return expected result');
  const c=sqlConfig(opts.env||process.env);
  return {connected:true,server:c.server,database:c.database,checkCount:loadChecks(opts.env||process.env).length};
 },opts);
}
async function runCheck(step,opts={}){
 const checks=loadChecks(opts.env||process.env);
 const check=checks.find(x=>x.id===step.checkId);
 if(!check)throw new DatabaseUnavailable('Unknown approved SQL check ID: '+String(step.checkId).slice(0,80));
 const params=safeParams(step.params||{},check.params);
 return withConnection(async pool=>{
  const request=pool.request();
  for(const name of check.params)request.input(name,params[name]);
  const result=await request.query(check.sql);
  if((result.recordset||[]).length>25)throw new DatabaseUnavailable('SQL check returned more than 25 rows; use a bounded aggregate');
  return {checkId:check.id,row:result.recordset?.[0]||{},rowCount:result.recordset?.length||0};
 },opts);
}
function assertDb(step,result){
 if(!result)throw new DatabaseUnavailable('assertDbValue requires a preceding dbQuery');
 const actual=readPath(result.row,step.selector);
 const expected=String(step.value);
 if(String(actual)!==expected)throw new Error(`DB assertion failed for ${step.selector}: expected value mismatch (sensitive database values withheld)`);
}
module.exports={DatabaseUnavailable,configured,driverInstalled,configFile,sqlConfig,validateReadOnly,validateCheck,loadChecks,catalog,safeParams,checkConnection,runCheck,assertDb};
