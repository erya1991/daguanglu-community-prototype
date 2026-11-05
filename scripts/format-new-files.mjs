// Formatting is limited to this task's new implementation; extracted framework files are excluded.
import fs from 'node:fs'
import path from 'node:path'
import prettier from '../.runtime/stage00/tools/qa/node_modules/prettier/index.mjs'
const files=[]
for(const dir of ['prototype-shared','web/manager/src/components','web/manager/src/views','miniapp/packages/foundation','tests']){
 const walk=d=>{for(const item of fs.readdirSync(d,{withFileTypes:true})){const f=path.join(d,item.name);if(item.isDirectory())walk(f);else if(/\.(js|mjs|vue|scss)$/.test(f))files.push(f)}};walk(dir)
}
files.push('web/manager/src/App.vue','web/manager/src/main.js','web/manager/src/services/foundation.js','web/manager/src/styles/stage00.scss')
for(const f of files){const s=fs.readFileSync(f,'utf8');fs.writeFileSync(f,await prettier.format(s,{filepath:f,singleQuote:true,semi:false,printWidth:110}))}
console.log('Formatted '+files.length+' new implementation files')
