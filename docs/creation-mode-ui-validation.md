# 创作模式与参数验证（2026-10-19）

- 广告／故事模式切换保留输入框内，13px、500字重；首页标题上方增加32px内边距，将标题与输入区一起下移，不改变会话布局。
- 已读取本地公开目录：Seedance 2 Mini的aspect_ratio及limits.ratios为空；Grok在固定六项中支持16:9、9:16、1:1。未写入后台配置，直接生成仍按目录置灰，不猜测模型能力。
- 已核实API：DirectorDraft规划总长4–120秒；非短剧项目创建支持六种画幅，导演准备跳过单镜头模型限制。因此前端导演模式独立读取项目画幅、使用目标总时长；直接生成维持原目录约束。未改API或调用生成。
- 226项前端测试通过，新增真实Vue computed验证导演六种比例、4–120秒以及切回直接模式恢复目录限制；生产构建通过。日志为`.codex-runtime/director-toolbar-tests.log`及`.codex-runtime/director-toolbar-build.log`。
- 浏览器实测：两个模式按钮计算样式13px／500，首页padding-top为32px；导演六种比例均可选择并选中4:3，时长显示目标总时长4–120秒；切回Grok直接模式后4:3／3:4／21:9禁用，恢复1–15秒。截图为`.codex-runtime/director-parameters-final.png`。
- 本轮未重新执行API测试和收费制作，不代表真实成片验证；未提交Git、未部署。
