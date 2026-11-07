import { clone, allocations } from "./common.js";
export const SCENARIOS = [
  "S02-BASE",
  "S02-BOOKING",
  "S02-QUAL",
  "S02-VERSION",
  "S02-EXISTING",
  "S02-ISOLATION",
  "S02-PAY",
  "S02-PAY-CLOSE",
  "S02-ARRANGE",
  "S02-CHANGE",
  "S02-HOME-READY",
  "S02-POINT-READY",
  "S02-IN-SERVICE",
  "S02-NOSHOW",
  "S02-CANCEL-FIRST",
  "S02-CANCEL-CONFIRMED",
  "S02-UNABLE",
  "S02-AFTERSALE",
  "S02-REWORK",
  "S02-RULING",
  "S02-REFUND-LIMIT",
  "S02-FUNDS",
  "S02-FUNDS-RULE",
  "S02-FUNDS-REFUND",
  "S02-FUNDS-EXCEPTION",
  "S02-EVAL",
  "S02-OLD",
  "S02-STATS",
];
const at = "2026-11-07T08:00:00+08:00";
const hist = (action) => [
  {
    记录编号: "S02-SEED-" + action,
    动作名称: action,
    记录时间: "2026-11-06T09:00:00+08:00",
    操作人: "演示资料维护人",
    操作人业务身份: "既有经营身份",
    结果状态: "成功",
    原因说明: "虚构业务资料，按有效前置事实预置",
    关联凭证: [],
    changes: [],
  },
];
export function prepare(s, session = "") {
  if (s.service) {
    if (s.service.schemaVersion !== 1)
      throw Error("便民服务数据版本不兼容，原数据已保留");
    return false;
  }
  const merchant = s.accounts.find((a) => a._id === "merchant");
  for (const [key, name] of [
    ["service-merchant-b", "安居维修服务商"],
    ["service-merchant-a", "青禾家政服务商"],
  ])
    if (!s.accounts.some((a) => a._id === key))
      s.accounts.push({
        ...clone(merchant),
        _id: key,
        登录账号: key,
        人员姓名: name,
        _rev: 1,
      });
  const property = s.accounts.find((a) => a._id === "property-admin");
  if (!s.accounts.some((a) => a._id === "service-web-limited"))
    s.accounts.push({
      ...clone(property),
      _id: "service-web-limited",
      登录账号: "service-web-limited",
      人员姓名: "受限服务查询账号",
      _rev: 1,
    });
  const merchants = [
    {
      _id: "SHOP-A",
      商户编号: "MER-A",
      商户名称: "青禾家政服务有限公司",
      经营店铺编号: "SHOP-A",
      经营店铺名称: "青禾社区家政",
      主体类型: "已入驻企业",
      商户状态: "正常",
      负责人姓名: "李青",
      经营联系电话: "13800001111",
      合作协议编号: "PACT-A",
      合作协议名称: "社区便民服务合作协议",
      协议版本: "V1",
      协议生效日期: "2026-01-01",
      协议截止日期: "长期",
      协议状态: "有效",
      _community: "C-A",
      _estate: "E-A",
    },
    {
      _id: "SHOP-B",
      商户编号: "MER-B",
      商户名称: "安居维修服务有限公司",
      经营店铺编号: "SHOP-B",
      经营店铺名称: "安居维修服务",
      主体类型: "已入驻企业",
      商户状态: "正常",
      负责人姓名: "王安",
      经营联系电话: "13900002222",
      合作协议编号: "PACT-B",
      合作协议名称: "社区便民服务合作协议",
      协议版本: "V1",
      协议生效日期: "2026-01-01",
      协议截止日期: "长期",
      协议状态: "有效",
      _community: "C-A",
      _estate: "E-A",
    },
  ];
  const cats = [
    ["CAT-HOUSE", "家政服务", "", false, false],
    ["CAT-CLEAN", "家庭保洁", "CAT-HOUSE", false, false],
    ["CAT-AC", "空调清洗", "CAT-HOUSE", false, true],
    ["CAT-FAN", "循环扇清洗", "CAT-HOUSE", false, false],
    ["CAT-GLASS", "居家玻璃清洗", "CAT-HOUSE", false, false],
    ["CAT-REPAIR", "安装维修", "", false, false],
    ["CAT-DRAIN", "空调排水故障维修", "CAT-REPAIR", true, true],
    ["CAT-HINGE", "冰箱门铰链调整", "CAT-REPAIR", false, false],
    ["CAT-INSTALL", "洗衣机安装", "CAT-REPAIR", false, false],
  ].map(([key, name, parent, mp, pp], i) => ({
    _id: key,
    _rev: 1,
    类目编号: key,
    类目名称: name,
    上级类目: parent,
    类目图标: "",
    类目说明: name + "服务",
    商户证明是否必需: mp,
    商户资质要求说明: mp ? "虚构样例：需核验对应服务证明" : "无专项要求",
    人员证明是否必需: pp,
    人员资质要求说明: pp ? "虚构样例：需核验对应人员证明" : "无专项要求",
    允许履约方式: ["HOME", "POINT"],
    类目排序: i,
    类目状态: "启用",
    history: hist("类目配置"),
  }));
  const leaf = cats.filter((c) => c.上级类目).map((c) => c._id),
    aCats = leaf.filter(
      (k) => !["CAT-DRAIN", "CAT-HINGE", "CAT-INSTALL"].includes(k),
    ),
    bCats = leaf.filter((k) => !aCats.includes(k));
  const material = (cat) => ({
    材料名称: "虚构专项服务证明",
    对应服务类目: [cat],
    证明编号: "DEMO-PROOF-" + cat,
    发证机构: "虚构演示机构",
    生效日期: "2026-01-01",
    长期有效: true,
    有效截止日期: "",
    证明文件: ["S02-SEED-PROOF"],
    核验结论: "认可",
    核验意见: "虚构样例资料",
    材料有效性: "有效",
    _seed: true,
  });
  const qualifications = merchants.map((m, i) => ({
    ...clone(m),
    _id: "Q-" + (i ? "B" : "A"),
    _rev: 1,
    _shop: m._id,
    获准服务类目: i ? bCats : aCats,
    获准社区: ["C-A"],
    获准小区: ["E-A"],
    服务经营有效性: "有效",
    新增交易资格: "可交易",
    资格限制原因: [],
    当前授权生效时间: "2026-11-01T08:00:00+08:00",
    最近审核时间: "2026-11-01T08:00:00+08:00",
    申请编号: "QUAL-" + (i ? "B" : "A"),
    申请版本: 1,
    申请服务类目: i ? bCats : aCats,
    申请覆盖社区: ["C-A"],
    申请覆盖小区: ["E-A"],
    申请说明: "已核验虚构经营资料",
    服务资质材料: i ? [material("CAT-DRAIN")] : [],
    申请状态: "已通过",
    申请历史: [],
    审核结果: "通过",
    审核意见: "样例已获准",
    审核轮次: 1,
    审核人: "物业管理员",
    审核时间: "2026-11-01T08:00:00+08:00",
    history: hist("资格审核"),
  }));
  const personnel = merchants.map((m, i) => ({
    _id: "P-" + (i ? "B" : "A"),
    _rev: 1,
    _shop: m._id,
    _community: "C-A",
    _estate: "E-A",
    服务人员编号: "P-" + (i ? "B" : "A"),
    姓名: i ? "王师傅" : "陈师傅",
    工作联系电话: i ? "13900003333" : "13800004444",
    所属商户名称: m.商户名称,
    关联工作人员账号: "",
    可执行服务类目: i ? bCats : aCats,
    技能说明: "按本商户授权服务类目执行",
    人员资质材料: i ? [material("CAT-DRAIN")] : [material("CAT-AC")],
    资质有效性: "有效",
    人员状态: "启用",
    内部备注: "虚构演示人员；不是登录岗位",
    创建时间: at,
    最近更新时间: at,
    history: hist("人员维护"),
  }));
  const methods = [
    {
      _id: "HOME",
      _rev: 1,
      履约方式编号: "HOME",
      履约方式名称: "上门",
      履约方式说明: "服务人员按确认安排上门",
      绑定流程模板: "上门",
      方式版本: 1,
      方式状态: "启用",
      history: hist("方式配置"),
    },
    {
      _id: "POINT",
      _rev: 1,
      履约方式编号: "POINT",
      履约方式名称: "预约到点",
      履约方式说明: "居民按确认安排到服务点，现场完成服务",
      绑定流程模板: "预约到点",
      方式版本: 1,
      方式状态: "启用",
      history: hist("方式配置"),
    },
  ];
  const point = {
    地点业务编号: "POINT-A",
    地点名称: "青禾社区便民服务点",
    所属社区名称: "青禾示例社区",
    所属小区名称: "青禾花园",
    详细地址: "青禾花园社区服务中心一层",
    联系号码: "13800001111",
    营业时间说明: "按双方确认安排接待",
    到点指引: "进入服务中心后查看便民服务标识",
    地点状态: "启用",
  };
  const rows = [
    [
      "SV-HOME",
      "家庭保洁",
      "CAT-CLEAN",
      "SHOP-A",
      99,
      "SPEC-HOME",
      "单次2小时基础保洁",
    ],
    [
      "SV-AC",
      "挂式空调清洗",
      "CAT-AC",
      "SHOP-A",
      129,
      "SPEC-AC",
      "单台标准清洗",
    ],
    [
      "SV-FAN",
      "台式循环扇清洗",
      "CAT-FAN",
      "SHOP-A",
      89,
      "SPEC-FAN",
      "单台可拆洗款",
    ],
    [
      "SV-GLASS",
      "居家玻璃清洗",
      "CAT-GLASS",
      "SHOP-A",
      119,
      "SPEC-GLASS",
      "单次2小时室内可及玻璃",
    ],
    [
      "SV-DRAIN",
      "空调排水故障维修",
      "CAT-DRAIN",
      "SHOP-B",
      159,
      "SPEC-DRAIN",
      "单次排水软管疏通",
    ],
    [
      "SV-HINGE",
      "冰箱门铰链调整",
      "CAT-HINGE",
      "SHOP-B",
      99,
      "SPEC-HINGE",
      "单台门铰链调整",
    ],
    [
      "SV-INSTALL",
      "洗衣机安装",
      "CAT-INSTALL",
      "SHOP-B",
      99,
      "SPEC-INSTALL",
      "单台标准安装",
    ],
    [
      "SV-POINT",
      "到点循环扇清洗",
      "CAT-FAN",
      "SHOP-A",
      59,
      "SPEC-POINT",
      "单台可拆洗款到点清洗",
    ],
  ];
  const services = rows.map(([key, name, cat, shop, price, spec, nameSpec]) => {
    const m = merchants.find((m) => m._id === shop),
      combo = (mode, p) => ({
        组合履约方式名称: mode,
        组合流程模板: mode,
        _method: mode === "上门" ? "HOME" : "POINT",
        组合计价方式: "固定规格价",
        组合固定价格: Number(p).toFixed(2),
        上门覆盖社区: mode === "上门" ? ["C-A"] : [],
        上门覆盖小区: mode === "上门" ? ["E-A"] : [],
        可服务门店或服务点: mode === "预约到点" ? [clone(point)] : [],
        完成证据要求: cat === "CAT-AC" ? "必需图片" : "可选图片",
        组合启用状态: "启用",
      });
    const data = {
      服务名称: name,
      所属服务类目: cat,
      经营主体名称: m.商户名称,
      经营店铺名称: m.经营店铺名称,
      服务主图: [],
      介绍图片: [],
      服务简介: name + "，固定规格一次服务",
      服务详细说明: "按选定规格和方式提供服务，不包含未约定的额外项目。",
      适用对象说明: "社区居民",
      预约须知: "期望时间不代表预约成功，具体安排需双方确认",
      公开服务电话: m.经营联系电话,
      服务规格集合: [
        {
          规格编号: spec,
          规格名称: nameSpec,
          规格说明: nameSpec,
          包含内容: nameSpec,
          不包含内容: "材料配件及其他未约定项目",
          预计服务时长: ["SV-HOME", "SV-GLASS"].includes(key) ? 120 : null,
          服务对象填写要求: cat === "CAT-AC" ? "必填" : "选填",
          服务对象填写提示: "请说明设备或服务对象",
          允许履约方式:
            key === "SV-POINT"
              ? ["预约到点"]
              : key === "SV-FAN"
                ? ["上门", "预约到点"]
                : ["上门"],
          规格启用状态: "启用",
          组合集合:
            key === "SV-POINT"
              ? [combo("预约到点", price)]
              : key === "SV-FAN"
                ? [combo("上门", 89), combo("预约到点", 59)]
                : [combo("上门", price)],
        },
      ],
    };
    return {
      _id: key,
      _rev: 1,
      _shop: shop,
      _community: "C-A",
      _estate: "E-A",
      服务编号: key,
      ...data,
      当前发布版本: 1,
      当前编辑版本: 1,
      审核状态: "通过",
      上架状态: "已上架",
      平台限制原因: "",
      当前展示价: price.toFixed(2),
      接收新预约状态: "接收中",
      推荐展示状态: "推荐",
      推荐顺序: 0,
      published: clone(data),
      versions: [
        { 版本: 1, 内容: clone(data), 审核结果: "通过", 发布时间: at },
      ],
      创建时间: at,
      最近更新时间: at,
      history: hist("供给审核发布"),
    };
  });
  for (const service of services) {
    const attachment = "S02-IMAGE-" + service._id;
    const meta = {
      name: service["服务名称"] + "-虚构示意.png",
      type: "image/png",
      size: 690,
      base64:
        "iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAACeUlEQVR4nO3SQQnDAAAEwXiLnTqp0kA/dRARPbj0GBgB+9jj+n5gxlEvgCBDM8XQTDE0UwzNFEMzxdBMMTRTDM0UQzPF0EwxNFMMzRRDM8XQTDE0UwzNFEMzxdBMMTRTDM0UQzPF0EwxNFMMzRRDM8XQTDE0UwzNFEMzxdBMMTRTDM0UQzPF0EwxNFMMzRRDM8XQTDE0UwzNFEMzxdBMMTRTDM2UBw19vl/8r/o/hiap/o+hSar/Y2iS6v8YmqT6P4Ymqf6PoUmq/2Nokur/GJqk+j+GJqn+j6FJqv9jaJLq/xiapPo/hiap/o+hSar/Y2iS6v8YmqT6P4Ymqf6PoUmq/2Nokur/GJqk+j+GJqn+j6FJqv9jaJLq/xiapPo/hiap/o+hSar/Y2iS6v8YmqT6P4Ymqf6PoUmq/2Nokur/GJqk+j+GJqn+j6FJqv9jaJLq/xiapPo/hiap/o+hSar/Y2iS6v8YmqT6P4Ymqf6PoUmq/2Nokur/GJqk+j+GJqn+j6FJqv9jaJLq/xiapPo/hiap/o+hSar/Y2iS6v8YmqT6P4Ymqf6PoUmq/2Nokur/GJqk+j+GJqn+j6FJqv9jaJLq/xiapPo/hiap/o+hSar/Y2iS6v8YmqT6P4Ymqf6PoUmq/2Nokur/GJqk+j+GJqn+j6FJqv9jaJLq/xiapPo/hiap/s/jhobfGZophmaKoZliaKYYmimGZoqhmWJophiaKYZmiqGZYmimGJophmaKoZliaKYYmimGZoqhmWJophiaKYZmiqGZYmimGJophmaKoZliaKYYmimGZoqhmWJophiaKYZmiqGZYmimGJophmaKoZlyA0EJeJzCu3kaAAAAAElFTkSuQmCC",
      stage02: true,
      owner: service._shop === "SHOP-B" ? "service-merchant-b" : "merchant",
      status: "成功",
      uploader: "经营资料维护人",
      uploadedAt: at,
      visibility: "public",
    };
    s.attachments[attachment] = meta;
    const descriptor = {
      id: attachment,
      name: meta.name,
      type: meta.type,
      size: meta.size,
      status: meta.status,
      uploader: meta.uploader,
      uploadedAt: meta.uploadedAt,
      description: "虚构服务示意图片",
      order: 1,
    };
    service["服务主图"] = [clone(descriptor)];
    service.published["服务主图"] = [clone(descriptor)];
    service.versions[0]["内容"]["服务主图"] = [clone(descriptor)];
  }
  s.service = {
    schemaVersion: 1,
    sequence: 100,
    revision: 1,
    clock: at,
    scenario: "S02-BASE",
    scenarioVersion: 1,
    ruleVersion: "DEMO-ALLOC-V1",
    operations: {},
    outcomes: {},
    accountShops: {
      merchant: "SHOP-A",
      "service-merchant-a": "SHOP-A",
      "service-merchant-b": "SHOP-B",
    },
    grants: {
      "platform-admin": {
        read: true,
        config: true,
        manage: false,
        review: false,
        ruling: false,
        funds: false,
        sensitive: false,
      },
      "property-admin": {
        read: true,
        config: false,
        manage: true,
        review: true,
        ruling: true,
        funds: true,
        sensitive: true,
      },
      "service-web-limited": {
        read: true,
        config: false,
        manage: false,
        review: false,
        ruling: false,
        funds: false,
        sensitive: false,
      },
    },
    merchants,
    categories: cats,
    methods,
    qualifications,
    personnel,
    services,
    orders: [],
    aftersales: [],
    evaluations: [],
    funds: [],
    exceptions: [],
    receivers: { "SHOP-A": "DEMO-A", "SHOP-B": "DEMO-B" },
  };
  if (!s.attachments["S02-SEED-PROOF"])
    s.attachments["S02-SEED-PROOF"] = {
      name: "虚构专项证明.txt",
      type: "text/plain",
      size: 64,
      text: "仅用于便民服务原型演示的虚构证明，不代表真实资质。",
      stage02: true,
      owner: "merchant",
      status: "成功",
      visibility: "qualification",
      _seed: true,
    };
  return true;
}
