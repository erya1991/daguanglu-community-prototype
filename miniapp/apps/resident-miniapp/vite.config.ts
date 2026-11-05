import {fileURLToPath,URL} from 'node:url'
import {defineConfig} from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
const at=(s:string)=>fileURLToPath(new URL(s,import.meta.url))
const mp=process.env.UNI_PLATFORM==='mp-weixin'
export default defineConfig({base:'/resident/',plugins:[uni()],resolve:{alias:[...(mp?[{find:'vue',replacement:at('../../node_modules/@dcloudio/uni-mp-vue/dist-x/vue.runtime.esm.js')}]:[]),{find:'@ui',replacement:at('./src/_shared/ui/components')},{find:'@core',replacement:at('./src/_core')},{find:'@',replacement:at('./src')}]}})
