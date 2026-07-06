import sys

with open("e:/workspace/ai-create-video/pages/dashboard.vue", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Replace the input area wrapping div
old_input_wrapper = """                  <div
                    class="group relative mt-10 overflow-hidden rounded-[24px] bg-panelSoft p-1.5 ring-1 ring-borderSoft transition-all duration-300"
                    :class="isDraggingFile ? 'bg-neonSoft/20 ring-neon/40' : 'hover:bg-panelSoft/80 hover:ring-borderSoft/80'"
                    @dragenter.prevent="isDraggingFile = true"
                    @dragover.prevent="isDraggingFile = true"
                    @dragleave.prevent="isDraggingFile = false"
                    @drop="handleDroppedFile"
                  >
                    <div class="rounded-[20px] bg-panel px-6 py-5 shadow-sm ring-1 ring-borderSoft">
                      <UiBaseTextarea
                        v-model="scriptDraft"
                        :placeholder="isDraggingFile ? '松开鼠标即可导入 TXT 剧本' : '写下你想讲的故事、场景或角色设定...'"
                        frame="plain"
                        full
                        size="lg"
                        class="min-h-[160px] resize-none text-[15px] leading-relaxed text-textMain placeholder:text-textMuted/60 bg-transparent focus:ring-0 focus:outline-none"
                      />
                    </div>
                  </div>"""

new_input_wrapper = """                  <div
                    class="group relative mt-10 flex flex-col rounded-[24px] bg-white/60 dark:bg-panelSoft/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-panel ring-1 ring-slate-200/80 dark:ring-borderSoft backdrop-blur-2xl transition-all duration-300 focus-within:ring-neon/50 focus-within:shadow-[0_0_20px_rgba(69,215,255,0.15)]"
                    :class="isDraggingFile ? 'bg-neon/5 ring-neon/50 scale-[1.01]' : 'hover:ring-slate-300 dark:hover:ring-borderSoft/80'"
                    @dragenter.prevent="isDraggingFile = true"
                    @dragover.prevent="isDraggingFile = true"
                    @dragleave.prevent="isDraggingFile = false"
                    @drop="handleDroppedFile"
                  >
                    <!-- 输入区 -->
                    <div class="p-6 pb-2">
                      <UiBaseTextarea
                        v-model="scriptDraft"
                        :placeholder="isDraggingFile ? '松开鼠标即可导入 TXT 剧本' : '写下你想讲的故事、场景或角色设定...'"
                        frame="plain"
                        full
                        size="lg"
                        class="min-h-[160px] resize-none text-[16px] leading-relaxed text-slate-900 dark:text-textMain placeholder:text-slate-400 dark:placeholder:text-textMuted/60 bg-transparent focus:ring-0 focus:outline-none"
                      />
                    </div>
                    <!-- 占位，之后填入底部控制栏 -->
                    __BOTTOM_TOOLBAR_PLACEHOLDER__
                  </div>"""

content = content.replace(old_input_wrapper, new_input_wrapper)

# 2. Extract and replace the bottom toolbar
old_toolbar = """                  <div class="mt-6 flex flex-col gap-4 rounded-[20px] bg-panel p-4 shadow-sm ring-1 ring-borderSoft lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex items-center gap-2 rounded-xl bg-panelSoft p-1">
                      <button class="rounded-lg bg-panel px-4 py-1.5 text-sm font-semibold text-textMain shadow-sm ring-1 ring-borderSoft">Agent模式</button>
                      <button class="rounded-lg px-4 py-1.5 text-sm font-medium text-textMuted transition-colors hover:text-textMain">人工模式</button>
                    </div>

                    <div class="flex flex-wrap items-center gap-3 lg:justify-end">
                      <UiBaseSelect
                        v-model="selectedTextModel"
                        :options="textModelOptions"
                        placeholder="文本模型"
                        size="sm"
                        class="min-w-[140px]"
                      />
                      <div class="h-4 w-px bg-borderSoft"></div>
                      <UiBaseSelect
                        v-model="selectedAspectRatio"
                        :options="aspectRatioOptions"
                        placeholder="比例"
                        size="sm"
                        class="min-w-[90px]"
                      />
                      <UiBaseSelect
                        v-model="selectedResolution"
                        :options="resolutionOptions"
                        placeholder="分辨率"
                        size="sm"
                        class="min-w-[100px]"
                      />
                      <UiBaseSelect
                        v-model="selectedVisualStyle"
                        :options="visualStyleSelectOptions"
                        placeholder="风格"
                        size="sm"
                        align="right"
                        class="min-w-[120px]"
                      />
                    </div>
                  </div>"""

new_toolbar = """                    <!-- 底部控制栏 -->
                    <div class="flex flex-col gap-4 border-t border-slate-200/60 dark:border-borderSoft/50 bg-slate-50/50 dark:bg-black/20 px-6 py-4 lg:flex-row lg:items-center lg:justify-between rounded-b-[24px]">
                      <div class="flex items-center gap-1.5 rounded-xl bg-slate-200/50 dark:bg-panelSoft p-1 backdrop-blur-md">
                        <button class="rounded-lg bg-white dark:bg-panel px-4 py-1.5 text-sm font-semibold text-slate-900 dark:text-textMain shadow-sm ring-1 ring-slate-200/80 dark:ring-borderSoft transition-all">Agent模式</button>
                        <button class="rounded-lg px-4 py-1.5 text-sm font-medium text-slate-500 dark:text-textMuted hover:text-slate-900 dark:hover:text-textMain transition-colors">人工模式</button>
                      </div>

                      <div class="flex flex-wrap items-center gap-3 lg:justify-end">
                        <UiBaseSelect
                          v-model="selectedTextModel"
                          :options="textModelOptions"
                          placeholder="文本模型"
                          size="sm"
                          class="min-w-[140px]"
                        />
                        <div class="h-4 w-px bg-slate-300 dark:bg-borderSoft"></div>
                        <UiBaseSelect
                          v-model="selectedAspectRatio"
                          :options="aspectRatioOptions"
                          placeholder="比例"
                          size="sm"
                          class="min-w-[90px]"
                        />
                        <UiBaseSelect
                          v-model="selectedResolution"
                          :options="resolutionOptions"
                          placeholder="分辨率"
                          size="sm"
                          class="min-w-[100px]"
                        />
                        <UiBaseSelect
                          v-model="selectedVisualStyle"
                          :options="visualStyleSelectOptions"
                          placeholder="风格"
                          size="sm"
                          align="right"
                          class="min-w-[120px]"
                        />
                      </div>
                    </div>"""

# Remove old toolbar
content = content.replace(old_toolbar, "")
# Inject new toolbar into placeholder
content = content.replace("                    __BOTTOM_TOOLBAR_PLACEHOLDER__\n", new_toolbar + "\n")

# 3. Custom style input replace
old_custom = """                  <div v-if="selectedVisualStyle === '自定义风格'" class="mt-4">
                    <UiBaseInput
                      v-model="customVisualStyle"
                      placeholder="输入自定义风格，例如：电影感写实、霓虹都市、古风水墨"
                      full
                      class="rounded-xl"
                    />
                  </div>"""

new_custom = """                  <div v-if="selectedVisualStyle === '自定义风格'" class="mt-4">
                    <UiBaseInput
                      v-model="customVisualStyle"
                      placeholder="输入自定义风格，例如：电影感写实、霓虹都市、古风水墨"
                      full
                      class="rounded-[16px] bg-white/60 dark:bg-panelSoft/40 ring-1 ring-slate-200/80 dark:ring-borderSoft shadow-sm"
                    />
                  </div>"""
content = content.replace(old_custom, new_custom)

with open("e:/workspace/ai-create-video/pages/dashboard.vue", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
