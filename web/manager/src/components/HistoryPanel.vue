<template><Table :columns="columns" :data="records" border no-data-text="暂无操作记录" size="small"/></template>
<script>
import {productText} from '../../../../prototype-shared/r3-product.js'
export default {
  props:{records:{type:Array,default:()=>[]}},
  computed:{columns(){return ['操作时间','操作人','操作名称','变更字段','操作说明／原因','操作结果'].map(key=>({title:key,key,minWidth:key==='操作说明／原因'?240:140,render:(h,p)=>h('span',this.show(p.row[key]))}))}},
  methods:{show(v){if(v===undefined||v===null||v==='')return '—';if(Array.isArray(v))return v.filter(k=>!String(k).startsWith('_')).join('、');if(/^\d{4}-\d{2}-\d{2}T/.test(String(v)))return new Date(Date.parse(v)+8*3600000).toISOString().slice(0,19).replace('T',' ');return String(productText(v))}}
}
</script>
