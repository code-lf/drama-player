<script setup lang="ts">
import LivDialog from '~/components/liv-ui/LivDialog.vue'
import { request } from '~/shared/api/adapters/httpAdapter'
import { useAuthStore } from '~/features/auth/store/useAuthStore'
import { creditReferenceGroups, formatReferenceCredits, type CreditReferenceRow } from '../creditReferenceGroups'

const props=defineProps<{open:boolean}>()
const emit=defineEmits<{'update:open':[value:boolean]}>()
const rows=ref<CreditReferenceRow[]>([]),loading=ref(false),error=ref('')
const groups=computed(()=>creditReferenceGroups(rows.value))
// 每次打开默认收起，折叠不丢失本次已读取的数据；不为开关表格发起额外请求。
const tableExpanded=ref<string|undefined>()
watch(()=>props.open,value=>{if(value)tableExpanded.value=undefined})
const auth=useAuthStore()
// 全局宿主切换账号或退出时关闭，阻止迟到请求进入下一账号的界面。
watch(()=>auth.session.user?.id,()=>{sequence++;emit('update:open',false)})
let sequence=0
/** 每次打开读取当前有效零售参考价；关闭和新请求使旧响应失效，不以旧表冒充最新价格。 */
async function load(){
  const current=++sequence
  loading.value=true;error.value='';rows.value=[]
  try{const data=await request<{items:CreditReferenceRow[]}>('/creation/credit-reference');if(current===sequence&&props.open)rows.value=data.items}
  catch(cause){if(current===sequence&&props.open)error.value=cause instanceof Error?cause.message:'积分参考表读取失败'}
  finally{if(current===sequence)loading.value=false}
}
watch(()=>props.open,value=>{if(value)load();else{sequence++;loading.value=false;rows.value=[]}}, {immediate:true})
onBeforeUnmount(()=>sequence++)
const questions=[
  {label:'积分如何使用？',content:'生成前会根据模型、规格、数量和素材核算本次积分，请核对确认卡后再确认生成。账户余额与消费记录可在个人菜单的积分账户中查看。'},
  {label:'为什么参考价与确认价可能不同？',content:'参考表采用指定示例参数，不是固定承诺。分辨率、质量、比例、输出时长、参考素材时长和数量都可能影响本次报价；以本次确认卡为准。'},
  {label:'确认后还会补扣吗？',content:'本次费用在确认时锁定，不因完成后的实际用量差异追加扣费。修改参数或重新生成需重新核价确认。'}
]
</script>

<template>
  <LivDialog :open="open" settings dark reference width="xl" title="常见问题" close-label="关闭常见问题" @update:open="emit('update:open',$event)">
    <div class="liv-faq-copy">
      <!-- 两组折叠项共用完整分隔线，不能让组件默认last:border-0漏掉参考表前的边界。 -->
      <UAccordion :items="questions" :ui="{item:'liv-faq-item',trigger:'liv-faq-question',body:'liv-faq-answer'}" />
      <UAccordion v-model="tableExpanded" :items="[{label:'积分参考表',value:'credits',slot:'credits'}]" :unmount-on-hide="false" :ui="{item:'liv-faq-item',trigger:'liv-faq-question',body:'liv-faq-answer'}">
      <template #credits-body>
      <section aria-label="积分参考表" class="space-y-3">
        <p class="liv-settings-note">参考积分向上取整展示，不是固定承诺；本次总积分按实际参数合计核算，不按表中取整单价直接相乘，以生成前确认价为准。图片示例为16:9、无参考图；Token视频示例为16:9、输出10秒，无参考视频或参考视频2秒取可用起价。参考素材按真实时长重新核算；按次档位保留适用时长区间。</p>
        <USkeleton v-if="loading" class="h-40 w-full" aria-label="正在读取积分参考表" />
        <div v-else-if="error" role="alert"><p>{{error}}</p><UButton color="neutral" variant="outline" @click="load">重新读取</UButton></div>
        <div v-else class="overflow-x-auto">
          <table class="liv-faq-table">
            <thead><tr><th scope="col">生成类型</th><th scope="col">对应模型</th><th scope="col">规格／操作</th><th scope="col">参考积分（非最终确认价）</th></tr></thead>
            <tbody v-for="group in groups" :key="group.type" :aria-label="`${group.label}积分参考`">
              <template v-for="(model,modelIndex) in group.models" :key="model.key">
                <tr v-for="(row,index) in model.rows" :key="`${model.key}-${index}`">
                  <th v-if="modelIndex===0&&index===0" scope="rowgroup" :rowspan="group.count">{{group.label}}</th>
                  <th v-if="index===0" scope="rowgroup" :rowspan="model.rows.length">{{model.name}}<small v-if="model.notice">{{model.notice}}</small></th>
                  <td>{{row.spec}}</td>
                  <td><template v-if="row.reference"><span :title="row.reference.note">{{formatReferenceCredits(row.reference.credits)}} 积分／{{({second:'秒',image:'张',request:'次'} as Record<string,string>)[row.reference.unit]||'次'}}{{row.reference.is_starting_price?'起':''}}</span></template><span v-else>暂未提供参考价：{{row.unavailable_reason||'缺少已核准预算或有效价格，请联系管理员核对'}}</span></td>
                </tr>
              </template>
              <tr v-if="!group.count"><th scope="row">{{group.label}}</th><td colspan="3">当前暂无已开放的{{group.label}}积分档位</td></tr>
            </tbody>
          </table>
          <p v-if="!rows.length" class="liv-settings-note">当前暂无可展示的积分参考档位。</p>
        </div>
      </section>
      </template>
      </UAccordion>
    </div>
  </LivDialog>
</template>
