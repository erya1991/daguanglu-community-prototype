import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
for(const app of ['resident','merchant','staff']){
 const dir=path.join(root,`miniapp/apps/${app}-miniapp/dist/build/mp-weixin`)
 if(!fs.existsSync(path.join(dir,'app.json')))throw Error('Build required: '+app)
 const saved=path.join(root,'.runtime/stage00/wechat',app)
 if(fs.existsSync(path.join(saved,'project.config.json')))for(const name of ['project.config.json','project.private.config.json']){if(fs.existsSync(path.join(saved,name)))fs.copyFileSync(path.join(saved,name),path.join(dir,name))}
 else fs.writeFileSync(path.join(dir,'project.config.json'),JSON.stringify({description:'Stage00虚构数据原型；本端Mock；无真实登录发布配置',packOptions:{ignore:[]},setting:{urlCheck:true,es6:true,enhance:true,postcss:true,minified:true},compileType:'miniprogram',appid:'touristappid',projectname:'DGL-Stage00-'+app,miniprogramRoot:'./'},null,2))
}
console.log('Prepared three separate local-test project configurations; no production AppID')
