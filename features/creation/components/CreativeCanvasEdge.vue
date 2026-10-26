<script setup lang="ts">
import {BaseEdge,EdgeLabelRenderer,getBezierPath,type EdgeProps} from '@vue-flow/core'
import {computed,useId} from 'vue'
import {creativeEdgeMotion,creativeEdgeBeam} from '../canvasEdgeMotion'
const props=defineProps<EdgeProps>()
const emit=defineEmits<{remove:[id:string]}>()
const path=computed(()=>getBezierPath(props))
// 自动来源线不可在布局层剪掉；只有用户创建的引用线提供断开入口。
const automatic=computed(()=>!!props.data?.automatic)
const motion=computed(()=>creativeEdgeMotion(props.id,props.sourceX,props.sourceY,props.targetX,props.targetY,!!props.data?.active))
const beam=computed(()=>creativeEdgeBeam(props.sourceX,props.sourceY,props.targetX,props.targetY))
// 每个组件实例独立渐变身份；不同会话/画布不串用SVG定义。
const gradientId=`creative-edge-white-${useId().replace(/:/g,'-')}`
</script>
<template>
  <BaseEdge :id="id" :path="path[0]" class="creative-edge" :class="{'is-active':data?.active,'is-selected':selected}"/>
  <!-- 光流沿真实Bezier路径从来源端到目标端；装饰层不抢占端口/断线的点击与拖拽。 -->
  <g class="creative-edge-flow" :class="{'is-active':data?.active,'is-selected':selected,'is-lineage':data?.lineage}" :style="motion" aria-hidden="true" pointer-events="none">
    <!-- 单条路径+移动渐变，只有一个连续可见区间；浏览器驱动动画，不用逐帧JS。 -->
    <defs><linearGradient :id="gradientId" gradientUnits="userSpaceOnUse" :x1="sourceX" :y1="sourceY" :x2="sourceX" :y2="sourceY">
      <animate v-for="coordinate in beam.coordinates" :key="coordinate.attribute" :attributeName="coordinate.attribute" :values="coordinate.values" :keyTimes="beam.keyTimes" :dur="motion['--creative-flow-duration']" :begin="motion['--creative-flow-delay']" repeatCount="indefinite"/>
      <stop offset="0" stop-color="var(--liv-graph-flow-head)" stop-opacity="0"/><stop offset=".25" stop-color="var(--liv-graph-flow-head)" stop-opacity=".12"/><stop offset=".75" stop-color="var(--liv-graph-flow-head)" stop-opacity=".6"/><stop offset="1" stop-color="var(--liv-graph-flow-head)" stop-opacity="1"/>
    </linearGradient></defs>
    <path :d="path[0]" pathLength="1" class="creative-edge-comet" fill="none" :stroke="`url(#${gradientId})`" stroke-dasharray="0 1 0 0">
      <animate attributeName="stroke-dasharray" :values="beam.dashValues" :keyTimes="beam.keyTimes" :dur="motion['--creative-flow-duration']" :begin="motion['--creative-flow-delay']" repeatCount="indefinite"/>
    </path>
  </g>
  <EdgeLabelRenderer v-if="selected&&!automatic"><UButton class="creative-edge-remove nodrag nopan" :style="{transform:`translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)`}" icon="i-lucide-unlink" size="sm" color="neutral" variant="soft" aria-label="断开引用连线" @click.stop="emit('remove',id)"/></EdgeLabelRenderer>
</template>
