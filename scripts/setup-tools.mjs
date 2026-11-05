import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..'),tools=path.join(root,'.runtime/stage00/tools'),qa=path.join(tools,'qa')
fs.mkdirSync(qa,{recursive:true})
const r=spawnSync('npm.cmd',['install','--prefix',qa,'--save-exact','--ignore-scripts','--no-audit','--no-fund','yarn@1.22.22','playwright@1.62.1','prettier@3.6.2'],{cwd:root,shell:true,stdio:'inherit',env:{...process.env,npm_config_cache:path.join(root,'.runtime/stage00/cache/npm')}})
if(r.status!==0)process.exit(r.status||1)
const source=path.join(qa,'node_modules/yarn'),target=path.join(tools,'yarn')
if(JSON.parse(fs.readFileSync(path.join(source,'package.json'))).version!=='1.22.22')throw Error('Unexpected Yarn version')
fs.mkdirSync(target,{recursive:true});fs.cpSync(source,target,{recursive:true})
console.log('Repository-local Yarn and validation tools ready; no global configuration changed')
