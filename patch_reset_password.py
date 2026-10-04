import re

with open('services/db.ts', 'r') as f:
    content = f.read()

# Update resetStudentPassword
old_reset = r"s\.id === id \? \{ \.\.\.s, password: '000000', hasChangedPassword: false, passwordChangeCount: 0, passwordResetByAdmin: true, failedAttempts: 0 \} : s"
new_reset = r"s.id === id ? { ...s, password: '000000', passwordHash: '', hasChangedPassword: false, passwordChangeCount: 0, passwordResetByAdmin: true, failedAttempts: 0 } : s"

content = re.sub(old_reset, new_reset, content)

with open('services/db.ts', 'w') as f:
    f.write(content)
