<script setup lang="ts">
import {showFormError} from "../ui/formFeedback";
import { nextTick, ref } from "vue";
import { onShow, onLoad } from "@dcloudio/uni-app";
import { service } from "@/services/foundation";
import AppPage from "../ui/components/AppPage.vue";
import AppNavbar from "../ui/components/AppNavbar.vue";
import AppButton from "../ui/components/AppButton.vue";
import AddressForm from "./AddressForm.vue";
const api = () => service.service,
  rows = ref<any[]>([]),
  options = ref<any>({}),
  form = ref<any>(null),
  errors = ref<any>({}),
  error = ref(""),
  saving = ref(false),
  owner = ref("");
const returnKey=ref(''), editId=ref(''), fromBooking=ref(false), opened=ref(false);
onLoad((query:any)=>{returnKey.value=query?.returnKey||'';for(let i=0;i<3;i++){const decoded=decodeURIComponent(returnKey.value);if(decoded===returnKey.value)break;returnKey.value=decoded}editId.value=query?.id||'';fromBooking.value=!!returnKey.value});
function cancel(){if(fromBooking.value)uni.navigateBack();else form.value=null}
async function load() {
  try {
    options.value = await api().options();
    if (owner.value !== options.value.actor._id) {
      form.value = null;
      owner.value = options.value.actor._id;
    }
    rows.value = await api().query("addresses");
    if(fromBooking.value&&!opened.value){const selected=rows.value.find(r=>r._id===editId.value);if(editId.value&&!selected)throw Error('地址不存在或无权编辑');edit(selected);opened.value=true;}
  } catch (e: any) {
    error.value = e.message;
  }
}
function edit(r?: any) {
  form.value = r
    ? JSON.parse(JSON.stringify(r))
    : {
        联系人姓名: options.value.actor?.name || "",
        联系人电话: "",
        省份: "江苏省",
        城市: "南京市",
        区县: "秦淮区",
        默认地址: !rows.value.length,
      };
  errors.value = {};
  error.value = "";
}
function setDefault(event: any) {
  form.value.默认地址 = event.detail.value;
}
async function act(name: string, r: any, data: any = {}) {
  if (saving.value) return;
  saving.value = true;
  error.value = "";
  try {
    const result=await api().command(name, { id: r?._id, revision: r?._rev, data });
    if(fromBooking.value&&name==='address.save'){
      const draft=await service.draft(returnKey.value);
      if(!draft?.data)throw Error('下单草稿已失效，地址已保存，请返回重新选择');
      await service.draft(returnKey.value,{...draft,selectedAddressId:result.id});
      uni.navigateBack();return;
    }
    form.value = null;
    await load();
    uni.showToast({ title: "已保存", icon: "none" });
  } catch (e: any) {
    error.value = e.message;
    errors.value = e.fields || {};
    await showFormError(e);
    await nextTick();
    const query = uni.createSelectorQuery();
    query.selectViewport().scrollOffset(() => {});
    query.select(".form-field--error").boundingClientRect();
    query.exec((items: any[]) => {
      if (items[1])
        uni.pageScrollTo({
          scrollTop: Math.max(
            0,
            (items[0]?.scrollTop || 0) + items[1].top - 80,
          ),
          duration: 200,
        });
    });
  } finally {
    saving.value = false;
  }
}
function remove(r: any) {
  uni.showModal({
    title: "删除地址",
    content: "已下单的地址快照保持不变。",
    success: (v) => {
      if (v.confirm) act("address.delete", r);
    },
  });
}
onShow(load);
</script>
<template>
  <AppPage secondary with-bottom-action
    ><template #navbar><AppNavbar :title="form?(form._id?'编辑地址':'新增地址'):'常用地址'" show-back /></template
    ><view class="addresses-page"
      ><text v-if="error" class="error">{{ error }}</text
      ><template v-if="form"
        ><AddressForm allow-bound
          :value="form"
          :options="options"
          :errors="errors"
          @input="form = $event"
        /><view class="default-row"
          ><text>设为默认地址</text
          ><switch
            :checked="!!form.默认地址"
            color="#1b4d53"
            @change="setDefault" /></view
        ><view class="address-actions"
          ><AppButton variant="secondary" @click="cancel">取消</AppButton
          ><AppButton :loading="saving" @click="act('address.save', form, form)"
            >保存地址</AppButton
          ></view
        ></template
      ><template v-else
        ><view v-if="!rows.length" class="empty"
          >还没有常用地址，添加后下单更方便</view
        ><view v-for="r in rows" :key="r._id" class="address-card"
          ><view
            ><text class="contact">{{ r.联系人姓名 }}　{{ r.联系人电话 }}</text
            ><text v-if="r.默认地址" class="tag">默认</text></view
          ><text class="address-text"
            >{{ r.省份 }}{{ r.城市 }}{{ r.区县 }}{{ r.详细地址 }}</text

          ><view class="row-actions"
            ><button v-if="!r.默认地址" @click="act('address.default', r)">
              设为默认</button
            ><button @click="edit(r)">编辑</button
            ><button @click="remove(r)">删除</button></view
          ></view
        ><view class="address-actions"
          ><AppButton @click="edit()">新增地址</AppButton></view
        ></template
      ></view
    ></AppPage
  >
</template>
<style scoped lang="scss">
.addresses-page {
  padding: 16px 16px 96px;
}
.address-card {
  background: #fff;
  padding: 18px;
  border-radius: 12px;
  margin-bottom: 12px;
}
.address-text {
  display: block;
  line-height: 1.6;
  margin: 12px 0;
}
.tag {
  margin-left: 10px;
  color: #1b4d53;
  font-size: 12px;
}
.row-actions,
.default-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.default-row {
  margin: 18px 0;
}
.row-actions button {
  font-size: 14px;
  color: #1b4d53;
  background: transparent;
  padding: 0 8px;
}
.address-actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  display: flex;
  gap: 12px;
  z-index: 30;
}
.address-actions > * {
  flex: 1;
}
.error {
  display: block;
  color: #bf3340;
  margin-bottom: 12px;
}
.empty {
  padding: 40px 12px;
  color: #738087;
}
.addresses-page{padding:12px 12px 96px}.address-card{padding:12px}.address-text{margin:8px 0}.row-actions button{background:#edf5f4;min-height:44px;line-height:44px;border-radius:8px}.row-actions button:last-child{color:#bf3340}
</style>
