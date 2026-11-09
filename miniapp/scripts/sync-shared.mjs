import fs from 'node:fs'
import path from 'node:path'
import './apply-h5-picker-fix.mjs'
const root=path.resolve(import.meta.dirname,'..')
for(const app of ['resident','merchant','staff']){
 const src=path.join(root,`apps/${app}-miniapp/src`)
 for(const [from,to] of [[path.join(root,'packages'),path.join(src,'_shared')],[path.join(root,'../prototype-shared'),path.join(src,'_core')]]){
  if(!to.startsWith(root+path.sep)||!to.includes(`${path.sep}src${path.sep}_`))throw Error('Unsafe generated target')
  fs.mkdirSync(to,{recursive:true});fs.cpSync(from,to,{recursive:true})
 }
}
