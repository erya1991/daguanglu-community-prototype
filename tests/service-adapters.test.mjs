import test from "node:test";
import assert from "node:assert/strict";
import { createUniAdapter } from "../prototype-shared/storage-uni.js";
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
function environment() {
  const data = new Map(),
    removed = [];
  globalThis.uni = {
    getStorageSync: (k) => clone(data.get(k)),
    setStorageSync: (k, v) => data.set(k, clone(v)),
    saveFile: ({ tempFilePath, success }) =>
      success({ savedFilePath: "/sandbox/" + tempFilePath.split("/").pop() }),
    removeSavedFile: ({ filePath, success }) => {
      removed.push(filePath);
      success({});
    },
  };
  return { data, removed };
}
test("AC02-047/052 微信Adapter专属复位保留基础与Stage01，并清理专属本端文件", async () => {
  const { data, removed } = environment(),
    api = createUniAdapter("merchant");
  await api.start();
  const key = "dgl-community-prototype-stage00:merchant",
    before = data.get(key),
    houses = clone(before.houses),
    stage01 = clone(before.stage01);
  const file = await api.service.upload({
    path: "temp/proof.png",
    name: "proof.png",
    size: 12,
  });
  assert.equal(data.get(key).attachments[file.id].stage02, true);
  await api.service.reset();
  assert.deepEqual(data.get(key).houses, houses);
  assert.deepEqual(data.get(key).stage01, stage01);
  assert.equal(data.get(key).attachments[file.id], undefined);
  assert.deepEqual(removed, ["/sandbox/proof.png"]);
});
test("AC02-042/046 三个微信App状态与身份独立，商业动作不开放给管理端", async () => {
  const { data } = environment(),
    merchant = createUniAdapter("merchant"),
    resident = createUniAdapter("resident"),
    staff = createUniAdapter("staff");
  await merchant.start();
  await resident.start();
  await staff.start();
  assert.ok(data.has("dgl-community-prototype-stage00:merchant"));
  assert.ok(data.has("dgl-community-prototype-stage00:resident"));
  assert.ok(data.has("dgl-community-prototype-stage00:staff"));
  await assert.rejects(() =>
    staff.service.command("service.save", {
      operationId: "staff-forbidden",
      data: { 服务名称: "非法供给", 所属服务类目: "CAT-CLEAN" },
    }),
  );
  assert.deepEqual(
    (await merchant.service.query("services")).map((r) => r._id).sort(),
    ["SV-AC", "SV-FAN", "SV-GLASS", "SV-HOME", "SV-POINT"].sort(),
  );
});
test("AC02-011/047 服务草稿按账号与service前缀隔离，复位不清其它阶段草稿", async () => {
  const { data } = environment(),
    api = createUniAdapter("resident");
  await api.start();
  await api.draft("stage01:form", { note: "保留" });
  await api.service.draft("booking", { 联系人姓名: "林示例" });
  assert.equal((await api.service.draft("booking")).联系人姓名, "林示例");
  await api.service.reset();
  assert.deepEqual(await api.draft("stage01:form"), { note: "保留" });
  assert.equal(await api.service.draft("booking"), null);
  assert.ok(data.get("dgl-community-prototype-stage00:resident").stage01);
});

test("AC02-043/049 微信预置PNG授权落沙盒且重复读取不重复写文件", async () => {
  const { data, removed } = environment(),
    writes = [];
  globalThis.uni.env = { USER_DATA_PATH: "/sandbox" };
  globalThis.uni.getFileSystemManager = () => ({
    writeFile: ({ filePath, data, encoding, success }) => {
      writes.push({ filePath, data, encoding });
      success({});
    },
  });
  const api = createUniAdapter("resident");
  await api.start();
  const supply = await api.service.record("services", "SV-HOME"),
    image = supply["服务主图"][0].id;
  const first = await api.service.attachment({
    table: "services",
    id: supply._id,
    attachmentId: image,
  });
  assert.equal(first.type, "image/png");
  assert.ok(first.path.endsWith(".png"));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].encoding, "base64");
  assert.equal(
    Buffer.from(writes[0].data, "base64").readUInt32BE(0),
    0x89504e47,
  );
  await api.service.attachment({
    table: "services",
    id: supply._id,
    attachmentId: image,
  });
  assert.equal(writes.length, 1);
  await api.service.reset();
  assert.ok(removed.includes(first.path));
  assert.ok(data.get("dgl-community-prototype-stage00:resident").houses.length);
});

test("AC02-045 微信服务上传失败辅助在落文件前生效，恢复后只生成一份附件", async () => {
  const { data } = environment(),
    api = createUniAdapter("merchant");
  await api.start();
  const key = "dgl-community-prototype-stage00:merchant";
  await api.service.auxiliary("mode", { kind: "upload", outcome: "failure" });
  const before = clone(data.get(key).attachments);
  await assert.rejects(
    () =>
      api.service.upload({
        path: "temp/failed-upload.png",
        name: "failed-upload.png",
        size: 12,
      }),
    /上传失败/,
  );
  assert.deepEqual(data.get(key).attachments, before);
  await api.service.auxiliary("mode", { kind: "upload", outcome: "normal" });
  const f = await api.service.upload({
    path: "temp/failed-upload.png",
    name: "failed-upload.png",
    size: 12,
  });
  assert.equal(data.get(key).attachments[f.id].stage02, true);
  assert.equal(
    Object.keys(data.get(key).attachments).length,
    Object.keys(before).length + 1,
  );
});
