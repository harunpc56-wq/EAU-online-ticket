import re

with open('server.ts', 'r') as f:
    content = f.read()

content = content.replace("res.write(\"data: update\\n\\n\");", "res.write(\"data: update\\n\\n\");\n      if (res.flush) res.flush();")

with open('server.ts', 'w') as f:
    f.write(content)
