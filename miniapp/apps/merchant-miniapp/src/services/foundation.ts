import type {Stage00Service} from '@core/types'
export const APP:string='merchant'
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
export const navigation=[{"mode":"workbench","label":"工作台","icon":"dashboard","path":"/pages/workbench/index"},{"mode":"operation","label":"经营","icon":"store","path":"/pages/operation/index"},{"mode":"order","label":"订单","icon":"order","path":"/pages/order/index"},{"mode":"profile","label":"我的","icon":"user","path":"/pages/profile/index"}]
