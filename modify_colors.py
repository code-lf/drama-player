import sys

with open("e:/workspace/ai-create-video/pages/dashboard.vue", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Point Balance
content = content.replace(
    '<p class="mt-1 text-2xl font-bold text-white tracking-tight">',
    '<p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">'
)

# 2. Theme Toggle & Home Button Hover
content = content.replace(
    'hover:bg-panelSoft/80 hover:text-textMain"',
    'hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"'
)
content = content.replace(
    'group-hover:text-white"',
    'group-hover:text-slate-900 dark:group-hover:text-white"'
)

# 3. AI Analysis Logline
content = content.replace(
    '<p class="mt-4 text-lg text-white/90">',
    '<p class="mt-4 text-lg text-slate-900/90 dark:text-white/90">'
)

# 4. My Projects menu
content = content.replace(
    "hover:bg-white/5 hover:text-white'",
    "hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'"
)

with open("e:/workspace/ai-create-video/pages/dashboard.vue", "w", encoding="utf-8") as f:
    f.write(content)
print("done")
