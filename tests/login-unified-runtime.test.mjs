// 执行真实登录 setup，短信与认证使用隔离适配器，不发送真实短信、不签署真实协议。
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import * as vue from 'vue'
const require=createRequire(import.meta.url),vr=createRequire(require.resolve('vue'))
const {parse,compileScript,compileTemplate}=vr('@vue/compiler-sfc'),{renderToString}=vr('@vue/server-renderer')
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
async function setupLogin(){
  const {descriptor}=parse(read('pages/login.vue')),script=compileScript(descriptor,{id:'login-test'})
  const module={exports:{}},calls=[]
  const authService={phoneLogin:async(...args)=>{calls.push(['sms',...args]);return {loggedIn:true}},accountLogin:async(...args)=>{calls.push(['password',...args]);return {loggedIn:true}},sendSmsCode:async(...args)=>{calls.push(['send',...args]);return {message:'已发送',retryAfterSeconds:1}}}
  const supportService={getLegalDocuments:async()=>{throw Error('isolated failure')}}
  const req=name=>name==='vue'?vue:name==='@lucide/vue'?{}:name.includes('authService')?{authService}:name.includes('supportService')?{supportService}:name.includes('useAuthStore')?{useAuthStore:()=>({applySession:()=>calls.push(['session'])})}:name.includes('useAccountStore')?{useAccountStore:()=>({refreshProfile:async()=>{}})}:name.includes('entities/support')?{defaultWebsiteInfo:{}}:{request:async()=>({})}
  const source=ts.transpileModule(script.content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  new Function('require','module','exports','ref','computed','onMounted','onBeforeUnmount','useRouter','useRoute','useNuxtApp',source)(req,module,module.exports,vue.ref,vue.computed,()=>{},()=>{},()=>({push:async()=>calls.push(['navigate'])}),()=>({query:{}}),()=>({$siteAsset:x=>x}))
  let api
  await renderToString(vue.createSSRApp({setup(){api=module.exports.default.setup({embedded:true},{expose(){},emit:()=>calls.push(['authenticated'])});return ()=>vue.h('div')}}))
  api.authCapabilities.value={password:true,sms:true,registration:true}
  api.legalDocuments.value=[{code:'user_service',versions:[{requiresAcceptance:true,title:'服务协议'}]},{code:'privacy_policy',versions:[{requiresAcceptance:true,title:'隐私政策'}]},{code:'ai_content_rules',versions:[{requiresAcceptance:true}]}]
  api.legalLoading.value=false
  return {api,calls}
}
test('短信登录只提交当前明确确认的协议，读取和切换不自动登录',async()=>{
  const {api,calls}=await setupLogin()
  api.account.value='13800000000';api.switchLoginMethod('sms');api.verifyCode.value='123456'
  assert.equal(api.canSubmit.value,true);assert.deepEqual(calls,[])
  assert.deepEqual(api.loginLegalLinks.value.map(x=>[x.title,x.url]),[['用户协议','/auth-terms'],['隐私政策','/legal/privacy_policy']])
  await api.submitAuth()
  assert.deepEqual(calls[0],['sms','13800000000','123456',['user_service','privacy_policy','ai_content_rules']])
  assert.equal(calls.some(x=>x[0]==='navigate'),false)
})
test('密码登录不调用注册接口，短信无配置或协议读取失败不能提交',async()=>{
  const {api,calls}=await setupLogin();api.account.value='13800000000';api.password.value='isolated-password'
  await api.submitAuth();assert.equal(calls[0][0],'password')
  calls.length=0;api.switchLoginMethod('sms');api.verifyCode.value='abcdef';assert.equal(api.canSubmit.value,false)
  api.verifyCode.value='123456';api.authCapabilities.value.sms=false;await api.submitAuth();assert.deepEqual(calls,[])
  api.authCapabilities.value.sms=true;await api.loadLegalDocuments();assert.equal(api.canSubmit.value,false)
  await api.submitAuth();assert.deepEqual(calls,[]);assert.ok(api.legalError.value)
})
for(const path of ['pages/login.vue','features/auth/components/LoginDialog.vue','components/legal/LegalReadingPage.vue','pages/auth-terms.vue'])test(`${path} 真实模板编译`,()=>{
  const {descriptor}=parse(read(path)),script=compileScript(descriptor,{id:path})
  const result=compileTemplate({source:descriptor.template.content,filename:path,id:path,compilerOptions:{bindingMetadata:script.bindings}})
  assert.deepEqual(result.errors,[])
})
test('统一登录移除记住我及注册分支，弹窗复用现有设置组件',()=>{
  // 最新要求仅扩大外框，表单宽度与控件规格不随弹窗扩张。
  assert.match(read('assets/css/tokens.css'),/--liv-login-dialog-width:\s*560px/)
  assert.match(read('assets/css/tokens.css'),/--liv-login-form-width:\s*408px/)
  assert.doesNotMatch(read('pages/login.vue'),/rememberMe|v-model="legalAccepted"|authMode/)
  assert.match(read('pages/login.vue'),/继续即表示您同意/)
  assert.match(read('features/auth/components/LoginDialog.vue'),/<LivDialog[^>]+settings dark/)
  assert.match(read('features/auth/components/LoginDialog.vue'),/注册\/登录享福利哦/)
  assert.doesNotMatch(read('features/auth/components/LoginDialog.vue'),/login-welcome/)
})
