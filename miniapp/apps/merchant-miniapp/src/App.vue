<script setup lang="ts">
import {onLaunch} from '@dcloudio/uni-app'
import {service} from './services/foundation'
onLaunch(()=>{service.start().catch(()=>{})})
</script>
<style lang="scss">
@import './_shared/theme/global.scss';
@import './_shared/foundation/foundation.scss';
</style>
