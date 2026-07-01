import fs from 'fs'
import path from 'path'

const filePath = path.resolve('pages/drama/[projectId].vue')
let content = fs.readFileSync(filePath, 'utf-8')

// Backgrounds
content = content.replace(/bg-white/g, 'bg-panel')
content = content.replace(/bg-\[#fafcff\]/g, 'bg-panelSoft')
content = content.replace(/bg-\[#eef2f7\]/g, 'bg-panelSoft')
content = content.replace(/bg-\[#f8fafc\]/g, 'bg-panelSoft')
content = content.replace(/bg-\[#f1f5f9\]/g, 'bg-panelSoft')

// Borders
content = content.replace(/border-\[#e7ebf4\]/g, 'border-borderSoft')
content = content.replace(/border-\[#edf1f7\]/g, 'border-borderSoft')
content = content.replace(/border-\[#d7dfef\]/g, 'border-borderSoft')
content = content.replace(/border-\[#e2e8f0\]/g, 'border-borderSoft')
content = content.replace(/border-\[#dbeafe\]/g, 'border-borderSoft')
content = content.replace(/border-\[#cbd5e1\]/g, 'border-borderSoft')
content = content.replace(/border-\[#e5e7eb\]/g, 'border-borderSoft')

// Text Colors
content = content.replace(/text-\[#0f172a\]/g, 'text-textMain')
content = content.replace(/text-\[#1e293b\]/g, 'text-textMain')
content = content.replace(/text-\[#334155\]/g, 'text-textMain')
content = content.replace(/text-\[#475569\]/g, 'text-textMuted')
content = content.replace(/text-\[#64748b\]/g, 'text-textMuted')
content = content.replace(/text-\[#94a3b8\]/g, 'text-textMuted')

// Accents
content = content.replace(/text-\[#4f46e5\]/g, 'text-neon')
content = content.replace(/border-\[#a5b4fc\]/g, 'border-neon')
content = content.replace(/bg-\[#eef2ff\]/g, 'bg-neonSoft/20')

// Fix the drawer overlay background
content = content.replace(/bg-\[rgba\(15,23,42,0\.36\)\]/g, 'bg-[#0f172a]/60')

fs.writeFileSync(filePath, content, 'utf-8')
console.log('Done replacing colors in [projectId].vue')
