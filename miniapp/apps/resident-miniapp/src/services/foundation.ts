import type {Stage00Service} from '@core/types'
export const APP:string='resident'
let adapter:any
// #ifdef H5
import {createBrowserAdapter} from '@core/storage-h5.js'
adapter=createBrowserAdapter(APP)
// #endif
// #ifdef MP-WEIXIN
import {createUniAdapter} from '@core/storage-uni.js'
adapter=createUniAdapter(APP)
// #endif
export const service:Stage00Service=adapter
export const navigation=[{"mode":"home","label":"首页","icon":"home","path":"/pages/home/index"},{"mode":"service","label":"服务","icon":"services","path":"/pages/service/index"},{"mode":"mall","label":"商城","icon":"cart","path":"/pages/mall/index"},{"mode":"profile","label":"我的","icon":"user","path":"/pages/profile/index"}]
