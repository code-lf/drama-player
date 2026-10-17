// 传输测试使用内存 XHR，不访问网络、不上传真实文件或执行生成。
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const js = ts.transpileModule(read('shared/api/adapters/uploadTransport.ts'), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const { uploadFormData } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

test('真实进度完成前封顶99，服务端成功后才到100；失败不自动重试', async () => {
  const original = globalThis.XMLHttpRequest
  let xhr, sends = 0
  globalThis.XMLHttpRequest = class {
    upload = {}; headers = {}; status = 200; responseText = '{"id":"versioned-item"}'
    constructor(){xhr=this}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(name,value){this.headers[name]=value}
    send(){sends++}
  }
  try {
    const progress = []
    const pending = uploadFormData('/api/library/upload',new FormData(),{Authorization:'test-only'},value=>progress.push(value))
    xhr.upload.onprogress({lengthComputable:true,loaded:100,total:100})
    assert.deepEqual(progress,[0,99])
    xhr.onload()
    assert.deepEqual(await pending,{id:'versioned-item'})
    assert.deepEqual(progress,[0,99,100])
    const failed = uploadFormData('/api/library/upload',new FormData(),{},()=>{})
    xhr.status=428; xhr.responseText='{"detail":{"error_code":"LEGAL_FEATURE_ACCEPTANCE_REQUIRED"}}';xhr.onload()
    await assert.rejects(failed,error=>error.statusCode===428&&error.data.detail.error_code==='LEGAL_FEATURE_ACCEPTANCE_REQUIRED')
    assert.equal(sends,2)
  } finally { globalThis.XMLHttpRequest = original }
})

test('粘贴、拖拽、加号复用上传入口，纯文本不插入HTML，临时附件不会当作引用', () => {
  const composer=read('features/creation/components/CreationComposer.vue')
  assert.match(composer, /@paste="paste"[^>]*@drop="dropFiles"/)
  assert.match(composer, /acceptFiles\(Array.from\(event.dataTransfer.files\)\)/)
  assert.match(composer, /files.length\) \{ event.preventDefault\(\); acceptFiles\(files\)/)
  assert.match(composer, /document.createTextNode\(text\)/)
  assert.match(composer, /role="progressbar"/)
  const workspace=read('features/creation/useCreationWorkspace.ts')
  assert.match(workspace, /if \(!version\) throw new Error/)
  assert.match(workspace, /URL.revokeObjectURL/)
  assert.match(workspace, /auth.session.user\?\.id !== owner/)
})
