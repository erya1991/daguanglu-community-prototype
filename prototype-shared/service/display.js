// Presentation only: do not infer successful funds from an order status.
const list = value => Array.isArray(value) ? value : [];
const amount = value => (Number(value || 0) / 100).toFixed(2);
export function moneySections(record) {
  const funds = record['资金类型'] ? [record] : list(record.fundRecords);
  const rows = funds.map(f => {
    const split = f['资金类型'] === '分账', allocation = f._allocation || f.ruleSnapshot?.allocation;
    return { id:f._id, kind:f['资金类型'], title:f['资金类型'] + ' · ' + f['资金状态'], values:[
      [split?'商户分账金额':f['资金类型']+'金额','¥'+(f['资金金额'] || amount(f._amount))],
      ...(split && allocation ? [['物业分账金额','¥'+amount(allocation.property)],['分配规则',(f.ruleSnapshot?.version || '规则V1').replace('DEMO-ALLOC-','规则')+'：按本单分配快照，服务商 '+amount(allocation.merchant)+' 元／物业 '+amount(allocation.property)+' 元']] : []),
      ['关联订单',f['服务订单号']||f['原服务订单号']],
      ['收款方',split?f['接收主体名称']:f['资金类型']==='退款'?'原付款账户':f['收款主体名称']],
      ['结果时间',f['成功时间']||f['资金结果更新时间']||f['发生时间']],
    ].filter(([,v])=>v!==undefined && v!==null && v!==''), actions:f._actions || [] };
  });
  return rows;
}
export function saleSections(record) {
  const sales = record['售后单号'] || record.plans ? [record] : list(record.aftersales || record.afterSales || (record.currentAftersale?[record.currentAftersale]:[]));
  if (!sales.length && ['未服务取消','未支付关闭'].includes(record['结案结果'])) return [{id:record._id,title:'订单已取消',values:[['处理结果',record['结案结果']],['取消原因',record['无法承接说明']||record['取消说明']],['处理时间',record['结案时间']]].filter(([,v])=>v)}];
  return sales.map(s=>{const plan=list(s.plans).slice(-1)[0]||{}, ruling=list(s.rulings).filter(r=>r['裁定有效状态']==='生效').slice(-1)[0]||{};return {
    id:s._id, title:(s['申请类型']==='核实取消'?'取消申请':s['申请类型']||'售后申请')+' · '+s['售后状态'],
    values:[['原订单',s['服务订单号']||s['原服务订单号']||s._order],['申请原因',s['申请原因']],['申请退款金额',s['申请退款金额']?('¥'+s['申请退款金额']):''],['处理方案',plan['方案处理类型']],['处理说明',plan['方案说明']],['住户答复',plan['居民方案答复']],['答复说明',plan['居民方案答复说明']],['处理结果',s['售后结案说明']||s['当前处理说明']],['历史裁定',ruling['裁定结果']],['历史结论',ruling['裁定说明']]].filter(([,v])=>v!==undefined&&v!==null&&v!==''),
    evidence:s['问题证据']||[], extraEvidence:list(s.evidence),
  }});
}
