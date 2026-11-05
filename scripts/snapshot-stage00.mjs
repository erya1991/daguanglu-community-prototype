import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..'),git=(...a)=>execFileSync('git',['--no-optional-locks','-C',root,...a],{encoding:'utf8'}).trim(),hash=b=>crypto.createHash('sha256').update(b).digest('hex')
if(git('branch','--show-current')!=='stage/00-foundation')throw Error('Unexpected branch')
if(git('diff','--cached','--name-only'))throw Error('Index must remain empty')
const dest='docs/stages/stage-00/evidence/candidate-snapshot.json'
const names=[...new Set(git('ls-files','--modified','--others','--exclude-standard').split('\n').filter(Boolean))].filter(f=>f!==dest)
const files=names.filter(f=>fs.existsSync(path.join(root,f))&&fs.statSync(path.join(root,f)).isFile()).map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file))),bytes:fs.statSync(path.join(root,file)).size}))
const candidate={id:'S00_'+new Date().toISOString().replace(/[:.]/g,'-'),recordedAt:new Date().toISOString(),branch:git('branch','--show-current'),baseCommit:git('rev-parse','HEAD'),status:'PROTOTYPE_OWNER_REVIEW_PENDING / NOT_STAGE_PASS',gitActions:'No staging, commit, push, merge or visibility change',indexEmpty:true,files,selfExcluded:dest,builds:JSON.parse(fs.readFileSync(path.join(root,'docs/stages/stage-00/evidence/build-results.json'))).run}
fs.writeFileSync(path.join(root,dest),JSON.stringify(candidate,null,2)+'\n');console.log(JSON.stringify({candidate:candidate.id,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),branch:candidate.branch,base:candidate.baseCommit,indexEmpty:true},null,2))
