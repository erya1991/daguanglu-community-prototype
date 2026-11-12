import { domain, day } from "./common.js";
import { billingCommand, billTemplate } from "./billing.js";
import { parkingCommand } from "./parking.js";
// Fictional, replaceable examples. Only explicit stage01-* sessions receive these fixtures.
export function seed(s) {
  const d = domain(s);
  if (!d.prepared || d.seeded) return;
  const ctx = { app: "web", account: "property-admin", role: "property" };
  billingCommand(s, ctx, "import", {
    text: billTemplate,
    source: "物业11月收费台账",
  });
  for (const b of d.bills)
    billingCommand(s, ctx, "publish", {
      id: b._id,
      revision: b._rev,
      confirm: true,
    });
  const pk = parkingCommand(s, ctx, "saveParkingRelation", {
    data: {
      PK02: "V-B",
      PK04: "PARK-A",
      PK05: "青禾花园停车场",
      PK08: "物业停车登记簿",
      PK09: "车辆及住户关系已核验",
      PK07: "有效",
    },
  });
  parkingCommand(s, ctx, "saveProduct", {
    data: {
      MP02: "地面停车月租",
      MP03: "PARK-A",
      MP04: "200.00",
      MP05: "按完整自然月，明确月初至月末；续费从原期间后办理",
      MP06: "有效停车关系的本人车辆",
      MP07: "启用",
      MP09: "平台登记后通行信息暂未同步",
      MP10: "青禾停车科技",
    },
  });
  parkingCommand(s, ctx, "saveTemporary", {
    data: {
      TB02: "PARK-20261105-018",
      TB03: pk.id,
      TB04: day() + "T08:00:00+08:00",
      TB05: day() + "T10:00:00+08:00",
      TB06: "12.00",
      TB09: "本次2小时共12元，由停车场台账人工确认",
      TB17: "青禾停车科技",
      TB10: "物业停车记录",
      TB12: "",
    },
  });
  d.seeded = true;
}
