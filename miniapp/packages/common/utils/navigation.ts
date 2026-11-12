const topPages=['/pages/home/index','/pages/service/index','/pages/mall/index','/pages/profile/index','/pages/workbench/index','/pages/operation/index','/pages/order/index','/pages/archive/index']
export function isUnavailablePath(path:string){const route=path.split('?')[0];return (/^\/pages\/(mall|product|cart)\//.test(route)&&route!=='/pages/mall/index')||/^\/pages\/order\/(detail|pay|confirm|cart)/.test(route)||/^\/pages\/(points|neighbor|idle|message)\//.test(route)}
export function resolvePath(path:string){return isUnavailablePath(path)?'/pages/unavailable/index?feature='+encodeURIComponent('社区商城'):path}
export function openPage(path?:string,available=true){if(!available||!path){uni.showToast({title:'功能开发中，敬请期待',icon:'none'});return false}const url=resolvePath(path);if(topPages.includes(url.split('?')[0]))uni.reLaunch({url});else uni.navigateTo({url});return true}
export function openSubPage(path?:string,available=true){return openPage(path,available)}
export function installNavigationGuard(){for(const method of ['navigateTo','redirectTo','reLaunch','switchTab'])uni.addInterceptor(method,{invoke(args:any){if(args.url)args.url=resolvePath(args.url)}})}
