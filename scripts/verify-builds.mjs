import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const stage=process.argv.includes('--stage01')?'stage-01':'stage-00', runtime=stage==='stage-01'?'stage01':'stage00'
const root=path.resolve(import.meta.dirname,'..'),run='BUILD_'+new Date().toISOString().replace(/[:.]/g,'-'),out=path.join(root,'.runtime',runtime,run)
fs.mkdirSync(out,{recursive:true})
const sync=spawnSync(process.execPath,['miniapp/scripts/sync-shared.mjs'],{cwd:root,encoding:'utf8'});if(sync.status!==0)throw Error(sync.stderr)
const jobs=[{id:'web',command:process.execPath,args:['.runtime/stage00/tools/yarn/bin/yarn.js','--cwd','web/manager','build'],cwd:root}]
for(const app of ['resident','merchant','staff'])for(const platform of ['h5','mp-weixin'])jobs.push({id:app+'-'+platform,command:'npm.cmd',args:['run','build:'+platform,'--workspace=@daguanglu/'+app+'-miniapp'],cwd:path.join(root,'miniapp'),shell:true})
for(const app of ['resident','merchant','staff'])jobs.push({id:app+'-types',command:process.execPath,args:['miniapp/node_modules/vue-tsc/bin/vue-tsc.js','--noEmit','-p',`miniapp/apps/${app}-miniapp/tsconfig.json`],cwd:root})
const results=[]
for(const job of jobs){const start=new Date(),r=spawnSync(job.command,job.args,{cwd:job.cwd,encoding:'utf8',shell:job.shell||false,maxBuffer:20*1024*1024,env:{...process.env,npm_config_cache:path.join(root,'.runtime/stage00/cache/npm'),YARN_CACHE_FOLDER:path.join(root,'.runtime/stage00/cache/yarn')}});const file=path.join(out,job.id+'.log');fs.writeFileSync(file,(r.stdout||'')+'\n'+(r.stderr||'')+(r.error?.stack||''));const result={id:job.id,command:[job.command,...job.args].join(' '),cwd:job.cwd,start:start.toISOString(),end:new Date().toISOString(),exit:r.status,status:r.status===0?'PASS':'FAIL',log:path.relative(root,file).replaceAll('\\','/')};results.push(result);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(job.id+': '+result.status)}
fs.mkdirSync(path.join(root,'docs/stages',stage,'evidence'),{recursive:true});fs.writeFileSync(path.join(root,'docs/stages',stage,'evidence/build-results.json'),JSON.stringify({run,node:process.version,results},null,2)+'\n');process.exitCode=results.some(r=>r.status!=='PASS')?1:0
