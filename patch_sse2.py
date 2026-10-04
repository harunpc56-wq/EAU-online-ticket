import re

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace("'Connection': 'keep-alive'", "'Connection': 'keep-alive',\n      'X-Accel-Buffering': 'no'")

with open('server.ts', 'w') as f:
    f.write(content)
