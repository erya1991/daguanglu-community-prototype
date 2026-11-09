// Local compatibility patch for the locked SDK; never changes the source mall or globals.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const root=path.resolve(import.meta.dirname,'..'),directory=path.join(root,'node_modules/@dcloudio/uni-h5'),target=path.join(directory,'dist/uni-h5.es.js')
const packageInfo=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'))
if(packageInfo.version!=='3.0.0-5020420260813003')throw Error('uni-h5版本变化，请重新核验选择器兼容补丁')
const originalHash='4c1832bba56db2ad57bf6ac6a9f044b9e7ffed63ba20a8ed957cbbbb1c4fbea1'
const original='      let $picker = pickerRef.value;\n      $picker.remove();\n      rootRef.value.prepend($picker);'
const replacement='      let $picker = pickerRef.value;\n      // DGL R3: the picker can unmount before its 260ms closing timer fires.\n      if (!$picker || !rootRef.value) return;\n      $picker.remove();\n      rootRef.value.prepend($picker);'
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),source=fs.readFileSync(target,'utf8')
let patched=source
if(!source.includes(replacement)){
  if(sha(source)!==originalHash||source.split(original).length!==2)throw Error('uni-h5源码摘要不匹配，未应用补丁')
  patched=source.replace(original,replacement);fs.writeFileSync(target,patched)
}else if(sha(source.replace(replacement,original))!==originalHash)throw Error('uni-h5已补丁文件包含额外变化，请核验')
const evidence=path.join(root,'../docs/stages/stage-00/evidence/r3-h5-picker-patch.json')
fs.writeFileSync(evidence,JSON.stringify({package:packageInfo.name,version:packageInfo.version,license:packageInfo.license,sourceHash:originalHash,patchedHash:sha(patched),reason:'H5 picker close timer dereferences null refs after component unmount; guard only the already-unmounted cleanup. No dependencies upgraded.',target:'miniapp/node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js'},null,2)+'\n')
