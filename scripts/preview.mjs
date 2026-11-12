import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const mounts={web:'web/manager/dist',resident:'miniapp/apps/resident-miniapp/dist/build/h5',merchant:'miniapp/apps/merchant-miniapp/dist/build/h5',staff:'miniapp/apps/staff-miniapp/dist/build/h5',_shared:'prototype-shared'}
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'}
const mobileIntegration=process.argv.includes('--mobile-integration');
const page=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>大光路社区物业服务</title><style>body{font:16px system-ui;background:#f5f7f9;color:#304345;max-width:960px;margin:70px auto;padding:24px}.apps{display:grid;grid-template-columns:1fr 1fr;gap:20px}a{display:block;background:white;padding:32px;border-radius:12px;color:#1b4d53;text-decoration:none}</style><h1>大光路社区物业服务</h1><div class="apps">${[['web','管理后台'],['resident','住户服务'],['merchant','商户中心'],['staff','物业工作台']].map(([app,name])=>`<a href="/${app}/${mobileIntegration?'?session=stage01-street-20261110':''}">${name} ↗</a>`).join('')}</div></html>`
const logRoot=path.join(root,mobileIntegration?'.runtime/mobile-integration':process.argv.includes('--stage01')?'.runtime/stage01':'.runtime/stage00');fs.mkdirSync(logRoot,{recursive:true})
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'self' blob:")
 const url=new URL(req.url,'http://localhost');fs.appendFileSync(path.join(logRoot,'preview-requests.ndjson'),JSON.stringify({time:new Date().toISOString(),method:req.method,path:url.pathname})+'\n')
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Static resources only')}
 if(url.pathname==='/'){res.setHeader('Content-Type',types['.html']);return res.end(page)}
 const [mount,...parts]=decodeURIComponent(url.pathname).slice(1).split('/'),base=mounts[mount]
 if(!base){res.writeHead(404);return res.end('Not found')}
 const allowed=path.resolve(root,base),file=path.resolve(allowed,parts.join('/')||'index.html')
 if(!file.startsWith(allowed+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Static file not found')}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res)
})
let port=Number(process.env.STAGE00_PORT||(mobileIntegration?19210:19201))
const host=process.env.PREVIEW_HOST||'127.0.0.1'
server.on('error',e=>{if(e.code==='EADDRINUSE'&&!process.env.STAGE00_PORT&&port<19300)server.listen(++port,host);else throw e})
server.on('listening',()=>{const info={url:`http://${host}:${port}`,host,port,pid:process.pid,started:new Date().toISOString(),type:'static-only'};fs.writeFileSync(path.join(logRoot,'preview.json'),JSON.stringify(info,null,2));console.log(JSON.stringify(info))})
server.listen(port,host)
