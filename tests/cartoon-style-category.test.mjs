// 运行真实风格预设，确认封面仅作展示、不绑定参考图或供应商风格编号。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const input=readFileSync(new URL('../features/creation/catalog.ts',import.meta.url),'utf8');
const module={exports:{}};
new Function('module','exports',ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(module,module.exports);
test('3D 卡通喜剧使用新角色原创封面及通用指导，不自动引用封面角色',()=>{
  const style=module.exports.localVisualStyles.find(row=>row.style_id==='local-cartoon-comedy-3d');
  assert.equal(style.display_name,'3D 卡通喜剧');assert.equal(style.render_medium,'3D');
  assert.ok(style.runtime_style_prefix.includes('不自动添加封面角色'));
  assert.equal(style.cover_url,'/creation-presets/cartoon-comedy-3d-v2.png');
  assert.ok(existsSync(new URL('../public'+style.cover_url,import.meta.url)));
});
test('案例分类数据保留，首页仅电商使用技能分类',()=>{
  const studio=readFileSync(new URL('../features/creation/components/CreationStudio.vue',import.meta.url),'utf8');
  assert.ok(studio.includes('aria-label="技能内容分类"'));
  assert.ok(studio.includes('v-for="item in cases"'));
  assert.ok(!studio.includes('<span class="creation-muted">{{item.category_label'));
  assert.ok(studio.includes('<h2>{{caseHeading}}</h2>'));
});
