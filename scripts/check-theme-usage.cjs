const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
// 首批只检查已经收敛过的公共组件与核心入口，避免旧页面一次性报出过多历史遗留。
const TARGET_FILES = [
  'pages/index.vue',
  'features/landing/components/LandingHeader.vue',
  'shared/ui/BaseButton.vue',
  'shared/ui/BaseInput.vue',
  'shared/ui/BaseSelect.vue',
  'components/ui/CreditAmount.vue',
  'components/ui/FluidImage.vue'
];
const ALLOWED_HINTS = ['gradient', 'shadow', 'blur', 'mix-blend', 'preview', 'video', 'canvas', 'logo', 'border-'];
const FILE_PATTERN = /\.(vue|ts|js|css)$/;
const RISKY_PATTERNS = [
  { name: 'text-white', regex: /\btext-white\b/ },
  { name: 'text-black', regex: /\btext-black\b/ },
  { name: 'bg-white', regex: /\bbg-white\b/ },
  { name: 'bg-black', regex: /\bbg-black\b/ },
  { name: 'hex-color', regex: /#[0-9a-fA-F]{3,8}/ }
];

function isAllowedLine(line) {
  return ALLOWED_HINTS.some((hint) => line.includes(hint));
}

const matched = [];

for (const relativeFile of TARGET_FILES) {
  const file = path.join(ROOT, relativeFile);
  if (!fs.existsSync(file) || !FILE_PATTERN.test(file)) continue;

  const content = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  content.forEach((line, index) => {
    if (isAllowedLine(line)) return;
    for (const pattern of RISKY_PATTERNS) {
      if (pattern.regex.test(line)) {
        matched.push(`${path.relative(ROOT, file)}:${index + 1} [${pattern.name}] ${line.trim()}`);
      }
    }
  });
}

if (matched.length > 0) {
  console.error('发现主题敏感目录中仍存在需要人工确认的硬编码样式：');
  console.error(matched.join('\n'));
  process.exit(1);
}

console.log('theme:check 通过，未发现新的高风险明暗主题硬编码。');
