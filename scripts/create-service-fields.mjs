import fs from 'node:fs'
import path from 'node:path'
const root = path.resolve(import.meta.dirname, '..')
const read = name => fs.readFileSync(path.join(root, 'docs/stages/stage-02', name), 'utf8')
const req=read('REQUIREMENTS.md'), plan=read('PLAN.md')
const mapping=new Map()
for(const line of plan.split(/\r?\n/)){
 const c=line.trim().split('|').slice(1,-1).map(x=>x.trim())
 const m=c[0]?.match(/^((?:\d{2}-[A-Z]|C\d)\.\d+)\s+(.+)$/)
 if(m)mapping.set(m[1],{path:c[1],acceptance:c[5]})
}
const tables=[];let table=null,header=false
for(const line of req.split(/\r?\n/)){
 const title=line.match(/^#{3,6}\s+(?:表)?((?:\d{2}-[A-Z])|C\d)[｜|\s：:](.+)$/)
 if(title){table={id:title[1],title:title[2].trim(),fields:[]};tables.push(table);header=false;continue}
 if(/^#{1,6}\s/.test(line)){table=null;header=false;continue}
 if(!table||!line.trim().startsWith('|'))continue
 const c=line.trim().split('|').slice(1,-1).map(x=>x.trim())
 if(c[0]==='字段名称'){header=true;continue}
 if(!header||c.length!==6||/^[-: ]+$/.test(c[0]))continue
 const id=table.id+'.'+String(table.fields.length+1).padStart(2,'0')
 table.fields.push({id,name:c[0],type:c[1],meaning:c[2],source:c[3],rule:c[4],rules:c[4],condition:c[5],access:c[5],...(mapping.get(id)||{})})
}
const useful=tables.filter(t=>t.fields.length)
const count=useful.reduce((n,t)=>n+t.fields.length,0)
if(useful.length!==42||count!==621)throw Error(`Unexpected Stage02 field baseline ${useful.length}/${count}`)
const dest=path.join(root,'prototype-shared/service/fields.js')
fs.mkdirSync(path.dirname(dest),{recursive:true})
fs.writeFileSync(dest,'// V1.1 product fields; generated from the confirmed requirement tables.\nexport const fieldTables = '+JSON.stringify(useful,null,2)+'\nexport const tableById = Object.fromEntries(fieldTables.map(t => [t.id,t]))\nexport const fieldsFor = (...ids) => ids.flatMap(id => tableById[id]?.fields || [])\nexport default fieldTables\n')
console.log(JSON.stringify({tables:useful.length,fields:count,mapped:useful.flatMap(t=>t.fields).filter(f=>f.path).length,ids:useful.map(t=>t.id)}))