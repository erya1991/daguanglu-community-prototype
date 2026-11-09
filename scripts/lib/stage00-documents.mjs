import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import {catalog} from '../../prototype-shared/catalog.js'
import {publicField} from '../../prototype-shared/r3-product.js'

export const currentStage00Marker='<!-- stage00-current-v1.1 -->'
export const headingSlug=text=>text.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu,'').trim().replace(/\s/g,'-')
export function currentFields(text){
 const groups=new Map();let anchor='',rows=null
 for(const line of text.split(/\r?\n/)){
  const match=/^<a id="(fields-[^"]+)"/.exec(line);if(match)anchor=match[1]
  if(line.startsWith('| 字段名称 |')){assert(anchor,'Field table requires a named anchor');rows=[];groups.set(anchor,rows)}
  else if(rows&&line.startsWith('| ')&&!line.startsWith('| ---')){const cells=line.split('|').slice(1,-1).map(value=>value.trim());assert.equal(cells.length,6,'Six field columns required');assert(cells.every(Boolean),'Empty field definition: '+cells[0]);assert(!/^\d|^_|网格|责任区域|包干/.test(cells[0]),'Not a current product field: '+cells[0]);for(const label of ['必填：','可见：','编辑：'])assert(cells[5].includes(label),cells[0]+' missing '+label);rows.push(cells)}
  else if(!line.startsWith('|'))rows=null
 }
 return groups
}
export function currentScenes(text){return text.split(/\r?\n/).filter(line=>/^\| S00-T\d{2} \|/.test(line)).map(line=>line.split('|').slice(1,-1).map(value=>value.trim()))}
export function verifyCurrentStage00Documents(root){
 const dir=path.join(root,'docs/stages/stage-00'),read=file=>fs.readFileSync(path.join(dir,file),'utf8'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),manifest=JSON.parse(read('evidence/pre-main-20261109/manifest.json')),names=['REQUIREMENTS','PLAN','ACCEPTANCE','RESULT'],documents=Object.fromEntries(names.map(name=>[name,read(name+'.md')]))
 for(const item of manifest.documents){assert.equal(sha(fs.readFileSync(path.join(root,item.target))),item.sha256,'Historical bytes changed '+item.target)}
 for(const item of [...manifest.templates,...manifest.protectedFiles])assert.equal(sha(fs.readFileSync(path.join(root,item.file))),item.sha256,'Protected source/template changed '+item.file)
 for(const [name,text] of Object.entries(documents)){
  assert(text.includes(currentStage00Marker),name+' current version marker');assert(text.includes('V1.1'),name+' version');assert(text.includes('微信'),name+' native scope missing');assert(text.includes('H5'),name+' H5 scope missing')
  const titles=source=>[...source.matchAll(/^## \d+\. (.+)$/gm)].map(match=>match[1].replace(/模板$/,''))
  const template=fs.readFileSync(path.join(root,'docs/templates/stage/'+name+'.md'),'utf8')
  assert.deepEqual(titles(text),titles(template),name+' primary chapter titles/order differ from local template')
 }
 const groups=currentFields(documents.REQUIREMENTS),all=[...groups.values()].flat(),namesIn=anchor=>new Set((groups.get(anchor)||[]).map(row=>row[0]))
 const objectAnchors={estates:'fields-estates',buildings:'fields-buildings',units:'fields-units',houses:'fields-houses',residents:'fields-residents',applications:'fields-applications',relations:'fields-relations',missing:'fields-missing',vehicles:'fields-vehicles',facilities:'fields-facilities',files:'fields-files',parking:'fields-parking'}
 for(const [object,anchor] of Object.entries(objectAnchors))for(const name of catalog[object].form.filter(field=>publicField(object,field)))assert(namesIn(anchor).has(name),object+' active form field missing '+name)
 for(const name of ['所属小区','关联楼栋','所属单元'])assert(namesIn('fields-resource-position').has(name),'Resource parent missing '+name)
 for(const name of ['所属社区','所属小区'])assert(namesIn('fields-vehicle-filters').has(name),'Vehicle filter missing '+name)
 assert.deepEqual([...namesIn('fields-personnel')],['人员姓名','所属物业组织','岗位','工作联系电话'])
 assert(!namesIn('fields-estates').has('小区编号'),'Hidden estate number restored')
 assert(!namesIn('fields-houses').has('房屋编号'),'Hidden house number restored in ordinary details')
 assert(namesIn('fields-binding-house').has('房屋编号'),'Binding house number access not documented')
 assert(namesIn('fields-account-contract').has('手机号'),'Mandatory account phone missing')
 for(const name of ['审核操作','对外审核说明','内部审核备注','申请状态'])assert(namesIn('fields-applications').has(name),'Approval field missing '+name)
 for(const name of ['版本号','生效日期','到期日期','提前提醒天数','到期提醒接收人','可查阅角色','可下载角色','资料使用状态','有效期提示'])assert(!namesIn('fields-files').has(name),'Cancelled file field restored '+name)
 assert.deepEqual([...namesIn('fields-resource-counts')],['房屋空间数量','设施点位数量','车位资源数量'])
 assert(!all.some(row=>['统计范围','统计日期','指标数值','人口','户数'].includes(row[0])),'Cancelled independent statistics restored')
 const expected=[...groups.entries()].flatMap(([anchor,rows])=>rows.map(row=>anchor+':'+row[0])).sort(),mapped=[...documents.PLAN.matchAll(/\[ ([^\]]+) \]\(REQUIREMENTS\.md#(fields-[^)]+)\)/g)].map(match=>match[2]+':'+match[1]).sort();assert.deepEqual(mapped,expected,'Current field mapping incomplete or duplicated')
 const rows=currentScenes(documents.ACCEPTANCE);assert.equal(rows.length,31);assert.deepEqual(rows.map(row=>row[0]),Array.from({length:31},(_,i)=>'S00-T'+String(i+1).padStart(2,'0')));assert(rows.every(row=>row.length===8),'Scene table columns')
 for(const id of ['S00-T03','S00-T15']){const row=rows.find(row=>row[0]===id);assert(row[6].includes('退出'));assert(!row[7].startsWith('PASS'))}
 for(const id of ['S00-T25','S00-T29']){const row=rows.find(row=>row[0]===id);assert.equal(row[6],'NOT_RUN');assert(!row[7].startsWith('PASS'))}
 const owner=JSON.parse(read('evidence/stage00-owner-acceptance-20261109.json'));assert.equal(owner.status,'OWNER_ACCEPTED_WEB_H5');assert.equal(owner.productionAcceptance,'NOT_RUN');assert.equal(owner.otherStagesAccepted,false);assert(Object.values(owner.native).filter(value=>value==='NOT_RUN').length===3);assert(owner.messages.every(message=>message.startsWith('已全部验证')))
 // The original 23/287 and 24/295 definitions are historical evidence, not an active UI quota.
 const baseline=JSON.parse(read('evidence/field-baseline.json'));assert.equal(baseline.length,23);assert.equal(baseline.reduce((count,group)=>count+group.rows.length,0),287)
 const legacy=[];let legacyRows=null;for(const line of read('evidence/pre-main-20261109/REQUIREMENTS.txt').split(/\r?\n/)){if(line.startsWith('| 字段名称 |')){legacyRows=[];legacy.push(legacyRows)}else if(legacyRows&&line.startsWith('| ')&&!line.startsWith('| ---'))legacyRows.push(line.split('|').slice(1,-1).map(value=>value.trim()));else if(!line.startsWith('|'))legacyRows=null}
 let legacyCount=0;Object.entries(catalog).forEach(([object,definition],index)=>{const active=definition.fields.filter(field=>!(object==='accounts'&&field.name==='手机号'));assert.deepEqual(active.map(field=>[field.name,field.type,field.meaning,field.source,field.rule,field.condition]),legacy[index]);legacyCount+=active.length});assert.equal(legacyCount,295)
 return {version:'V1.1',templateChapterOrder:true,currentFieldGroups:groups.size,currentFieldRows:all.length,mappedRows:mapped.length,scenes:rows.length,legacyDefinitions:{tables:24,rows:295},historicalBaseline:{tables:23,rows:287},immutableHistoricalDocuments:manifest.documents.length,protectedTemplates:manifest.templates.length,protectedOtherStageFiles:manifest.protectedFiles.length,ownerStatus:owner.status,nativeCurrent:'NOT_RUN by owner scope',businessTestsOrBuildsExecuted:false}
}
