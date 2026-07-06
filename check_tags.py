import re

with open("e:/workspace/ai-create-video/pages/dashboard.vue", "r", encoding="utf-8") as f:
    lines = f.readlines()

stack = []
self_closing = ['br', 'hr', 'img', 'input', 'meta', 'link', 'circle', 'path', 'rect', 'UiFluidImage', 'UiBaseTextarea', 'UiBaseSelect', 'UiBaseInput']

for i, line in enumerate(lines):
    # Find all tags
    # <tag ...> or </tag> or <tag ... />
    for match in re.finditer(r'<(/?[a-zA-Z0-9-]+)([^>]*)>', line):
        tag_name = match.group(1)
        attrs = match.group(2)
        
        if tag_name.startswith('/'):
            # closing tag
            name = tag_name[1:]
            if len(stack) > 0 and stack[-1][0] == name:
                stack.pop()
            else:
                print(f"Line {i+1}: Found closing </{name}> but expected <{stack[-1][0] if stack else 'Nothing'}>")
        else:
            # opening tag
            name = tag_name
            if name in self_closing or attrs.strip().endswith('/'):
                pass
            else:
                stack.append((name, i+1, line.strip()))

if len(stack) > 0:
    print("Unclosed tags:")
    for tag in stack:
        print(f"Line {tag[1]}: <{tag[0]}> - {tag[2]}")
else:
    print("All tags matched perfectly!")
