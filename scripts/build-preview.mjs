import path from 'node:path'
import {spawnSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..')
const commands=[{cmd:process.execPath,args:['miniapp/scripts/sync-shared.mjs'],cwd:root},{cmd:process.execPath,args:['.runtime/stage00/tools/yarn/bin/yarn.js','--cwd','web/manager','build'],cwd:root},...['resident','merchant','staff'].map(a=>({cmd:'npm.cmd',args:['run','build:h5','--workspace=@daguanglu/'+a+'-miniapp'],cwd:path.join(root,'miniapp'),shell:true}))]
for(const c of commands){const r=spawnSync(c.cmd,c.args,{cwd:c.cwd,shell:c.shell||false,stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
console.log('Four same-origin preview artifacts ready. Run npm run preview.')
