<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { skillCenterService, type SkillRecipe } from '~/shared/api/services/skillCenterService'
import type { SystemSkill } from '~/features/creation/types'
import { libraryService } from '~/shared/api/services/libraryService'
import type { LibraryItem, LibraryVersion } from '~/entities/library/types'
const rows = ref<SystemSkill[]>([])
const {auth,requireLogin}=useWorkbenchAuth()
import { creationService } from '~/shared/api/services/creationService'
import {skillDocumentTemplate} from '../skillDocument'
const enabled = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const scope = ref<'platform' | 'user' | 'favorite'>('platform')
const category = ref('')
const search = ref('')
const detail = ref<SystemSkill | null>(null)
const recipe = ref<SkillRecipe | null>(null)
const editingKey = ref('')
const importedText = ref('')
const importOpen = ref(false)
const documentTab = ref('文档')
const assistDescription = ref(''), assetItems = ref<LibraryItem[]>([])
const config = computed(() => recipe.value?.config || {})
const scoped = computed(() => rows.value.filter(row => scope.value === 'favorite' ? row.is_favorite : row.kind === scope.value))
// 分类从当前真实目录生成，不呈现无数据分类。
// 展示分类按用户确认的顺序，旧数据通过别名映射继续可检索。
const categories = ['自媒体','广告营销','游戏','短漫剧','周边设计']
/** 兼容既有目录分类；后台填写新分类时直接使用，不迁移或覆盖历史版本。 */
function displayCategory(row: SystemSkill){
  // 运营已填写的新分类优先；旧视频分类中的广告与展示不能误归到自媒体。
  if(categories.includes(row.category))return row.category
  if(['product','poster','showcase','ad'].includes(row.base_code || row.id))return '广告营销'
  return ({通用:'自媒体',视频:'自媒体',音乐:'自媒体',电商:'广告营销',短剧:'短漫剧',图片:'周边设计'} as Record<string,string>)[row.category] || row.category
}
const visible = computed(() => scoped.value.filter(row => (!category.value || displayCategory(row) === category.value) && `${row.label} ${row.description}`.toLowerCase().includes(search.value.toLowerCase())))
watch(scope, () => { if(scope.value!=='platform')category.value = '' })
function report(cause: unknown) { error.value = cause instanceof Error ? cause.message : '操作失败，请稍后重试。' }
async function refresh() {
  loading.value = true
  try { const data = auth.session.loggedIn ? await skillCenterService.list() : {...await creationService.publicCatalog('free'),user_skills_enabled:false}; rows.value = data.skills; enabled.value = data.user_skills_enabled; error.value = '' } catch (cause) { report(cause) } finally { loading.value = false }
}
onMounted(refresh)
watch(()=>auth.session.user?.id,()=>{rows.value=[];recipe.value=null;detail.value=null;void refresh()})
async function favorite(row: SystemSkill) {
  if(!requireLogin())return
  if (busy.value) return
  busy.value = true
  try { await skillCenterService.favorite(row.id, !row.is_favorite); row.is_favorite = !row.is_favorite } catch (cause) { report(cause) } finally { busy.value = false }
}
function trySkill(row: SystemSkill) {
  if (row.is_active === false) return
  // 试用仅导航选中技能，不自动提交任务或扣费。
  const entry = row.entries.includes('music') ? 'music' : row.entries[0] || 'free'
  return navigateTo({ path: '/dashboard', query: { entry, skill: row.id } })
}
async function edit(row?: SystemSkill, copy = false) {
  if(!requireLogin())return
  error.value = ''
  try {
    const base = row || rows.value.find(item => item.kind === 'platform')
    if (!base) throw new Error('暂无可用基础技能，请联系管理员。')
    const data = await skillCenterService.export(base.id)
    recipe.value = data.skill
    editingKey.value = row?.kind === 'user' && !copy ? row.id : ''
    recipe.value.expected_version = editingKey.value ? base.version : 0
    if (!editingKey.value) recipe.value.config.label = `我的${base.label}`
    detail.value = null
  } catch (cause) { report(cause) }
}
async function changeBase(event: Event) {
  const row = rows.value.find(item => item.id === (event.target as HTMLSelectElement).value)
  if (row) await edit(row, true)
}
async function save() {
  if(!requireLogin())return
  if (!recipe.value || busy.value) return
  if(String(recipe.value.config.document||'').length>20000){error.value='技能文档最多 20000 字符，请精简后保存。';return}
  busy.value = true
  try { await skillCenterService.save(recipe.value, editingKey.value || undefined); recipe.value = null; scope.value = 'user';category.value='';search.value=''; await refresh() } catch (cause) { report(cause) } finally { busy.value = false }
}
async function archive(row: SystemSkill) {
  if(!requireLogin())return
  // 归档只隐藏新试用入口，不删除不可变版本及历史任务。
  busy.value = true
  try { await skillCenterService.archive(row.id); detail.value = null; await refresh() } catch (cause) { report(cause) } finally { busy.value = false }
}
async function download(row: SystemSkill) {
  if(!requireLogin())return
  try {
    const data = await skillCenterService.export(row.id)
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'liv-skill.json'; link.click(); URL.revokeObjectURL(url)
  } catch (cause) { report(cause) }
}
async function importRecipe() {
  if(!requireLogin())return
  try { recipe.value = await skillCenterService.importPreview(importedText.value); recipe.value.expected_version = 0; editingKey.value = ''; importOpen.value = false } catch (cause) { report(cause) }
}
/** 私有资源仅从本人素材库读取，选择时固定版本；不把文件地址当授权凭证。 */
async function loadAssets(){try{const base=rows.value.find(row=>row.id===recipe.value?.base_code);assetItems.value=(await libraryService.list({scope:'personal'})).items.filter(item=>base?.media_types.includes(item.media_type))}catch(cause){report(cause)}}
function toggleAsset(item: LibraryItem, version: LibraryVersion){if(!recipe.value)return;const index=recipe.value.references.findIndex(ref=>ref.version_id===version.id);if(index>=0)recipe.value.references.splice(index,1);else if(recipe.value.references.length<12)recipe.value.references.push({item_id:item.id,version_id:version.id,purpose:item.media_type==='video'?'reference_video':'reference'})}
async function assist(){if(!recipe.value || busy.value || !assistDescription.value.trim())return;busy.value=true;try{const generated=await skillCenterService.assist(recipe.value.base_code,assistDescription.value);recipe.value.config=generated.config}catch(cause){report(cause)}finally{busy.value=false}}
async function importFile(event: Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;if(file.size>128*1024){error.value='技能文档最多 128KB。';return}importedText.value=await file.text();input.value=''}
/** 附件通过真实个人资料库上传，保存为固定版本；基础能力不支持的类型不自动引用。 */
async function uploadAttachment(event: Event){
  const input=event.target as HTMLInputElement,file=input.files?.[0]
  if(!file || !recipe.value || busy.value)return
  busy.value=true
  try{const item=await libraryService.upload(file,'other');const base=rows.value.find(row=>row.id===recipe.value?.base_code);if(!base?.media_types.includes(item.media_type))throw new Error('附件已保存至个人资料库，但当前基础能力不能引用此类型。');if(item.versions[0])toggleAsset(item,item.versions[0]);await loadAssets()}catch(cause){report(cause)}finally{busy.value=false;input.value=''}
}
const documentPreview = computed(() => recipe.value ? JSON.stringify({ format: 'liv-skill-v1', license: 'private', skill: recipe.value }, null, 2) : '')
</script>
<template>
  <section class="skill-center">
    <header><div><h1>技能</h1><p>选择平台能力，或创建自己的私有创作配方。</p></div><div class="actions"><button :disabled="!enabled" @click="importOpen = true">导入配方</button><button class="primary" :disabled="!enabled" @click="edit()">＋ 创建我的技能</button></div></header>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <div class="filters"><nav class="category-nav" aria-label="技能分类"><button :class="{active:scope!=='platform'}" @click="scope='user'">我的技能</button><span class="nav-divider"/><button :class="{active:scope==='platform'&&!category}" @click="scope='platform';category=''">全部</button><button v-for="name in categories" :key="name" :class="{active:scope==='platform'&&category===name}" @click="scope='platform';category=name">{{ name }}</button></nav><input v-model="search" type="search" placeholder="搜索技能" aria-label="搜索技能"></div>
    <div v-if="scope!=='platform'" class="categories"><button :class="{active:scope==='user'}" @click="scope='user'">我创建的</button><button :class="{active:scope==='favorite'}" @click="scope='favorite'">我收藏的</button></div>
    <div v-if="loading" class="grid" aria-label="正在加载技能"><div v-for="index in 6" :key="index" class="skeleton" /></div>
    <div v-else-if="visible.length" class="grid"><article v-for="row in visible" :key="row.id" class="card"><button class="cover" @click="detail=row"><img v-if="row.cover" :src="row.cover" :alt="row.label" loading="lazy"><UIcon v-else name="i-lucide-zap" /><span>{{ row.kind==='user'?'个人':'平台' }}</span></button><button class="name" @click="detail=row">{{ row.label }}</button><p>{{ row.description }}</p><div class="actions"><button :aria-label="row.is_favorite?'取消收藏':'收藏'" :aria-pressed="!!row.is_favorite" :disabled="busy" @click="favorite(row)"><UIcon :name="row.is_favorite?'i-lucide-bookmark-check':'i-lucide-bookmark'" /></button><button class="try" :disabled="row.is_active===false" @click="trySkill(row)">{{ row.is_active===false?'已停用':'试试看' }}</button></div></article></div>
    <div v-else class="empty">{{ scope==='user'?'还没有个人技能，点击创建或复制平台配方。':'暂无匹配技能。' }}</div>
    <div v-if="detail" class="overlay" @click.self="detail=null"><section class="dialog"><header><h2>{{ detail.label }}</h2><button aria-label="关闭技能详情" @click="detail=null">×</button></header><p>{{ detail.description }}</p><dl><dt>必需输入</dt><dd>{{ detail.requirement || '描述创作需求' }}</dd><dt>产出</dt><dd>{{ (detail.base_code || detail.id)==='free'?'图片／视频':(detail.base_code || detail.id).startsWith('mv-')?'音乐 MV':{image:'图片',video:'视频',music:'音乐',drama:'短剧'}[detail.target] }}</dd><dt>模型策略</dt><dd>{{ detail.model_strategy==='fixed'?'固定专用模型：'+detail.default_model:detail.model_strategy==='candidates'?'限定候选模型':'平台开放模型' }}</dd><dt>执行流程</dt><dd class="pre">{{ detail.instructions || '核对需求与素材 → 预估费用 → 点击生成 → 查看真实结果' }}</dd><dt>示例</dt><dd v-for="example in detail.examples" :key="example">{{ example }}</dd></dl><div class="actions"><button :disabled="!enabled" @click="edit(detail,true)">复制为我的技能</button><template v-if="detail.kind==='user'"><button @click="edit(detail)">编辑</button><button @click="download(detail)">导出</button><button :disabled="busy" @click="archive(detail)">归档</button></template><button class="primary" :disabled="detail.is_active===false" @click="trySkill(detail)">试试看</button></div></section></div>
    <div v-if="recipe" class="overlay"><section class="editor"><header><h2>{{ editingKey?'编辑个人技能':'创建我的技能' }}</h2><button aria-label="关闭编辑" :disabled="busy" @click="recipe=null">×</button></header><p v-if="error" role="alert" class="error">{{ error }}</p><div class="editor-body"><form @submit.prevent="save"><label>用 AI 整理想法<textarea v-model="assistDescription" placeholder="说明你想创建的技能，生成后仍可编辑。" /></label><button type="button" :disabled="busy || !assistDescription.trim()" @click="assist">生成可编辑草稿</button><label>基础能力<select :value="recipe.base_code" :disabled="!!editingKey" @change="changeBase"><option v-for="row in rows.filter(item=>item.kind==='platform')" :key="row.id" :value="row.id">{{ row.label }}</option></select></label><label>技能名称<input v-model="config.label" required maxlength="80"></label><label>分类<input v-model="config.category" required maxlength="40"></label><label>简介<textarea v-model="config.description" required maxlength="1000" /></label><label>输入要求<input v-model="config.requirement" maxlength="300"></label><label>提示词前缀<textarea v-model="config.prompt_prefix" maxlength="3000" /></label><label>提示词后缀<textarea v-model="config.prompt_suffix" maxlength="3000" /></label><label>执行说明<textarea v-model="config.instructions" maxlength="10000" /></label><p>模型范围、必需素材及权限继承基础能力。保存不产生生成费用；试用按实际报价计费。</p><button class="primary" :disabled="busy" type="submit">{{ busy?'正在保存…':'保存私有技能' }}</button></form><aside><div class="tabs"><button v-for="tab in ['文档','资源附件','引用资产']" :key="tab" :class="{active:documentTab===tab}" @click="documentTab=tab; if(tab==='引用资产')loadAssets()">{{ tab }}</button></div><section v-if="documentTab==='文档'"><label>SKILL.md 专业文档<UTextarea v-model="config.document" aria-label="技能专业文档" :rows="16" :maxlength="20000" class="w-full"/></label><UButton v-if="!config.document" variant="soft" @click="config.document=skillDocumentTemplate(config.label)">填入文档模板</UButton><p>原文随技能版本保存；输出参数仍由服务端校验，不执行附件脚本。文档最多 20000 字符。</p><details><summary>导入导出配方</summary><pre>{{documentPreview}}</pre></details></section><div v-else-if="documentTab==='资源附件'"><p>上传素材进入个人资料库并固定版本，不执行脚本或命令；素材类型仍受基础能力限制。</p><input type="file" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4,video/mp4,video/webm" :disabled="busy" @change="uploadAttachment"/><pre>{{JSON.stringify(recipe.references,null,2)}}</pre></div><div v-else><p>选择真实固定版本，最多 12 项。素材权限继承基础能力。</p><button type="button" @click="loadAssets">刷新资料库</button><article v-for="item in assetItems" :key="item.id"><b>{{item.name}}</b><button v-for="version in item.versions" :key="version.id" :class="{primary:recipe.references.some(ref=>ref.version_id===version.id)}" @click="toggleAsset(item,version)">v{{version.version_no}}</button></article><pre>{{ JSON.stringify(recipe.references,null,2) }}</pre></div></aside></div></section></div>
    <div v-if="importOpen" class="overlay" @click.self="importOpen=false"><section class="dialog"><header><h2>导入 JSON / SKILL.md</h2><button @click="importOpen=false">×</button></header><p>请确认内容使用许可；只接受 liv-skill-v1 JSON 或 liv-skill-json 配方块。未知步骤与脚本不会执行。可先导出个人技能作为示例。</p><label>选择配方文件<input type="file" accept=".json,.md" @change="importFile" /></label><textarea v-model="importedText" class="import" placeholder="粘贴受控配方文档" /><p v-if="error" class="error">{{ error }}</p><button class="primary" @click="importRecipe">校验并预览</button></section></div>
  </section>
</template>
<style scoped>
/* 技能中心沿用深色工作台；列表与编辑区各自滚动，弹层不推动页面。 */
.skill-center{padding:28px;color:#eee;max-width:1500px;margin:auto}.skill-center header,.actions,.filters,.tabs,.categories{display:flex;align-items:center;gap:10px}.skill-center header,.filters{justify-content:space-between}.skill-center h1{font-size:28px}.skill-center h2{font-size:20px}.skill-center p{color:#a3a3ad;font-size:13px;line-height:1.7}.skill-center button{border:1px solid #38383f;background:#252529;color:#eee;border-radius:9px;padding:9px 14px;cursor:pointer}.skill-center button:disabled{opacity:.4;cursor:not-allowed}.skill-center .primary{background:var(--liv-accent);border-color:var(--liv-accent);color:white}.skill-center input,.skill-center textarea,.skill-center select{border:1px solid #38383f;background:#1c1c20;color:#eee;border-radius:8px;padding:10px;font:inherit}.filters{margin:26px 0 16px}.tabs .active,.categories .active{background:#41414a}.categories{flex-wrap:wrap;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}.card{background:#131316;border:1px solid #303035;border-radius:18px;padding:14px;min-width:0}.card .cover{position:relative;display:block;width:100%;padding:0;aspect-ratio:16/9;overflow:hidden;border:0;background:#222228}.cover img{width:100%;height:100%;object-fit:cover}.cover span{position:absolute;left:8px;top:8px;border-radius:8px;background:#151519d9;padding:3px 8px;font-size:11px}.card .name{padding:12px 0 0;text-align:left;font-weight:700;border:0;background:transparent}.card p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:44px}.try{flex:1}.empty{padding:70px;text-align:center;color:#999}.skeleton{height:270px;background:#242428;border-radius:18px}.overlay{position:fixed;inset:0;z-index:300;background:#000b;display:flex;align-items:center;justify-content:center;padding:20px}.dialog,.editor{background:#19191e;border:1px solid #3c3c43;border-radius:20px;padding:24px;max-height:90dvh;overflow:auto;width:min(720px,100%)}.editor{width:min(1200px,100%)}.editor-body{display:grid;grid-template-columns:1fr 1fr;gap:24px}.editor form{display:grid;gap:12px}.editor label{display:grid;gap:6px;font-size:13px}.editor aside{min-width:0}.editor pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;padding:14px;background:#101013;border-radius:10px;max-height:60vh;overflow:auto}.skill-center dt{margin-top:16px;color:#a1a1aa;font-size:12px}.skill-center dd{margin:6px 0;line-height:1.7}.pre{white-space:pre-wrap}.import{width:100%;height:260px}.error{color:#ff8c9f!important}@media(max-width:1250px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.grid{grid-template-columns:1fr}.skill-center{padding:18px}.filters,header{flex-wrap:wrap}.editor-body{grid-template-columns:1fr}}
</style>
<style scoped>
/* 实测参考页：24px 标题、14px 名称、12px/32px 试用按钮；减少过重字重。 */
.skill-center h1{font-weight:630;line-height:30px}.skill-center .card .name{font-weight:500}.skill-center .card .actions button{font-size:12px}.skill-center .category-nav button{font-size:16px;font-weight:450}
</style>
<style scoped>
/* 列数跟随内容区宽度，不依赖整个应用窗口宽度，内嵌窄面板也保持合理卡片尺寸。 */
.skill-center{container-type:inline-size}.skill-center header p{display:none}.skill-center .card .actions .iconify{width:14px;height:14px}.skill-center .actions>.primary{height:34px;border-radius:20px;font-size:12px}.skill-center .category-nav{font-size:14px}@container(max-width:1000px){.grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@container(max-width:720px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@container(max-width:430px){.grid{grid-template-columns:1fr}}
</style>
<style scoped>
/* 对齐紧凑资产卡片：正文 13px、说明 12px，按钮使用站点主题变量。 */
.skill-center{font-size:13px;max-width:1320px;padding:24px}.skill-center h1{font-size:24px;font-weight:700}.skill-center h2{font-size:18px}.skill-center button{font:inherit;padding:7px 12px}.skill-center .primary{background:var(--liv-accent);border-color:var(--liv-accent)}.skill-center p{font-size:12px}.filters{margin:28px 0 24px;gap:20px}.category-nav{display:flex;align-items:center;gap:18px;white-space:nowrap;overflow-x:auto}.category-nav button{border:0;padding:4px 0;background:transparent;color:#8e8e98;font-size:14px;font-weight:600}.category-nav button.active{color:#fff}.nav-divider{height:16px;width:1px;background:#38383e;flex-shrink:0}.card{padding:12px;border-radius:20px}.card .name{font-size:14px}.card p{line-height:1.5;min-height:36px;margin:7px 0 14px}.card .actions button{height:32px;padding:4px 11px;background:var(--liv-button-bg);border-color:#303034}.try{border-radius:20px!important}.skill-center .filters input{height:32px;font-size:12px;padding:6px 12px}.categories button{font-size:12px}.grid{gap:18px}@media(max-width:900px){.filters{flex-wrap:wrap}.category-nav{width:100%;gap:16px}}
</style>
