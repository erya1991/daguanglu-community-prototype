import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const mounts={web:'web/manager/dist',resident:'miniapp/apps/resident-miniapp/dist/build/h5',merchant:'miniapp/apps/merchant-miniapp/dist/build/h5',staff:'miniapp/apps/staff-miniapp/dist/build/h5',_shared:'prototype-shared'}
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'}
const page=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>大光路 Stage00 原型入口</title><style>body{background:#f5f7f9;font:16px system-ui;color:#304345;max-width:1000px;margin:70px auto;padding:24px}h1{font-size:32px}p{line-height:1.9;color:#718083}.apps{display:grid;grid-template-columns:1fr 1fr;gap:20px}a{display:block;text-decoration:none;color:#1b4d53;padding:30px;background:#fff;border:1px solid #e1e7e7;border-radius:14px}a strong{display:block;font-size:22px;margin-bottom:10px}.tag{color:#ad6b29}code{background:#e9eeee;padding:5px}.note{margin-top:32px}</style><span class="tag">演示模式 · 全部虚构数据 · 待人工验收</span><h1>大光路社区基础原型</h1><p>Web与三个H5在同一源共享演示会话；各端身份独立。建议先打开住户与Web完成绑定审核，再用管理端查询。</p><label>演示会话 <input id="session" value="demo" aria-label="演示会话"></label><div class="apps">${[['web','Web 基础管理','默认资料员；控制区可切审核员等身份'],['resident','住户端','首页｜服务｜商城｜我的'],['merchant','商户端','工作台｜经营｜订单｜我的'],['staff','管理端','工作台｜档案｜我的']].map(([id,note,desc])=>`<a href="/${id}/?session=demo" target="_blank" data-app="${id}"><strong>${note} ↗</strong>${desc}</a>`).join('')}</div><p class="note">手机端建议使用390或414px视口。复位位于各端演示控制区，仅作用当前原型会话。微信产物使用本端Mock，样例切换不表示跨App同步。</p><script>document.querySelector('#session').addEventListener('input',e=>{let s=e.target.value.replace(/[^a-zA-Z0-9_-]/g,'')||'demo';document.querySelectorAll('[data-app]').forEach(a=>a.href='/'+a.dataset.app+'/?session='+s)})</script></html>`
const logRoot=path.join(root,'.runtime/stage00');fs.mkdirSync(logRoot,{recursive:true})
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
let port=Number(process.env.STAGE00_PORT||19200)
server.on('error',e=>{if(e.code==='EADDRINUSE'&&port<19300)server.listen(++port,'127.0.0.1');else throw e})
server.on('listening',()=>{const info={url:`http://127.0.0.1:${port}`,port,pid:process.pid,started:new Date().toISOString(),type:'static-only'};fs.writeFileSync(path.join(logRoot,'preview.json'),JSON.stringify(info,null,2));console.log(JSON.stringify(info))})
server.listen(port,'127.0.0.1')
