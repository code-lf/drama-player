// 质量错误恢复回归，不以静态字串匹配代替实际状态转换。
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../features/creation/imageQuality.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {imageQualityError,IMAGE_QUALITY_ERROR}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('仅高质量模型：从不兼容的中切回高后清除错误',()=>{
  let error=imageQualityError('','image','medium',['high'])
  assert.equal(error,IMAGE_QUALITY_ERROR)
  error=imageQualityError(error,'image','high',['high'])
  assert.equal(error,'')
})
test('切换非图片清除旧质量错误，不清除其他错误',()=>{
  assert.equal(imageQualityError(IMAGE_QUALITY_ERROR,'video','medium',[]),'')
  assert.equal(imageQualityError('接口暂不可用','image','high',['high']),'接口暂不可用')
})
