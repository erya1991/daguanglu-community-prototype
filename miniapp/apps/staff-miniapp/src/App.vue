<script setup lang="ts">
import {onLaunch,onPageNotFound} from '@dcloudio/uni-app'
import {service} from './services/foundation'
import {installNavigationGuard} from './_shared/common/utils/navigation'
installNavigationGuard()
onPageNotFound(()=>uni.redirectTo({url:'/pages/unavailable/index'}))
onLaunch(()=>{service.start().catch(()=>{})})
</script>
<style lang="scss">
@import './_shared/theme/global.scss';
@import './_shared/foundation/foundation.scss';
@import './_shared/theme/business.scss';
</style>
