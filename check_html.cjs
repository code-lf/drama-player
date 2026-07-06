const fs = require('fs');
const content = fs.readFileSync('e:/workspace/ai-create-video/pages/dashboard.vue', 'utf8');

// Extract just the template part
const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
if (!templateMatch) {
    console.log('No template found');
    process.exit(1);
}

const templateStr = templateMatch[1];
const tags = [];
const regex = /<(\/?)([a-zA-Z0-9-]+)([^>]*)>/g;
let match;
while ((match = regex.exec(templateStr)) !== null) {
    tags.push({
        full: match[0],
        isClosing: match[1] === '/',
        name: match[2],
        attrs: match[3]
    });
}

const stack = [];
const selfClosingNames = ['br', 'hr', 'img', 'input', 'meta', 'link', 'circle', 'path', 'rect', 'svg', 'UiFluidImage', 'UiBaseTextarea', 'UiBaseSelect', 'UiBaseInput'];

for (let i = 0; i < tags.length; i++) {
    const t = tags[i];
    
    if (t.isClosing) {
        if (stack.length > 0 && stack[stack.length - 1].name === t.name) {
            stack.pop();
        } else {
            console.log(`Mismatch! Found closing </${t.name}> but expected <${stack.length ? stack[stack.length-1].name : 'Nothing'}>. Tag index: ${i}`);
            // Let's print some context around the match
            console.log(`Context: ${templateStr.substring(Math.max(0, match.index - 50), match.index + 50)}`);
            process.exit(1);
        }
    } else {
        if (!selfClosingNames.includes(t.name) && !t.attrs.trim().endsWith('/')) {
            stack.push({name: t.name, full: t.full, index: i});
        }
    }
}

if (stack.length > 0) {
    console.log('Unclosed tags:', stack.map(s => s.full).join('\n'));
} else {
    console.log('All tags matched perfectly!');
}
