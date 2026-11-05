import {chromium} from '../.runtime/stage00/tools/qa/node_modules/playwright/index.mjs'
import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..'),base=JSON.parse(fs.readFileSync(path.join(root,'.runtime/stage00/preview.json'))).url
const output=path.join(root,'.runtime/stage00/browser-first');fs.mkdirSync(output,{recursive:true})
const context=await chromium.launchPersistentContext(path.join(output,'profile'),{channel:'msedge',headless:true,viewport:{width:390,height:844}}),results=[]
for(const app of ['resident','merchant','staff','web']){
 const page=await context.newPage(),errors=[],requests=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))requests.push(r.url())})
 if(app==='web')await page.setViewportSize({width:1366,height:768})
 await page.goto(base+'/'+app+'/?session=browser-first');await page.waitForTimeout(1800)
 await page.screenshot({path:path.join(output,app+'.png'),fullPage:true})
 results.push({app,url:page.url(),text:(await page.locator('body').innerText()).slice(0,2400),errors,external:requests});await page.close()
}
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await context.close()
