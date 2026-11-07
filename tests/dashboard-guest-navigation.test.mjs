// 直接执行页面的布局判定表达式，覆盖登录过期/深链游客/登录恢复，不请求私人接口。
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import assert from 'node:assert/strict'

const source=readFileSync(new URL('../pages/dashboard.vue',import.meta.url),'utf8')
const expression=source.match(/const immersiveSession = computed\(\(\) => (.+)\)/)?.[1]
function immersive(loggedIn,user,session,view='console'){
  assert.ok(expression,'必须测试页面真实布局表达式')
  return runInNewContext(expression,{authStore:{session:{loggedIn,user}},activeWorkspaceView:{value:view},route:{query:{session}}})
}
test('游客和过期登录即使携带会话编号也不显示私人会话顶栏',()=>{
  assert.equal(immersive(false,null,'private-session'),false)
  assert.equal(immersive(false,{id:'stale-user'},'private-session'),false)
  assert.equal(immersive(true,null,'private-session'),false)
})
test('本人登录后恢复深链沉浸布局，首页及其他工作区不受影响',()=>{
  assert.equal(immersive(true,{id:'owner'},'private-session'),true)
  assert.equal(immersive(true,{id:'owner'},undefined),false)
  assert.equal(immersive(true,{id:'owner'},'private-session','library'),false)
})
