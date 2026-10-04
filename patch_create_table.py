import re

with open('server.ts', 'r') as f:
    content = f.read()

# Update CREATE TABLE IF NOT EXISTS students
students_table_re = r'(CREATE TABLE IF NOT EXISTS students \([\s\S]*?exam_eligibility TEXT)(,\n\s*created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n\s*\);)'
replacement_table = r'\1,\n      has_changed_password INTEGER DEFAULT 0,\n      password_change_count INTEGER DEFAULT 0,\n      failed_attempts INTEGER DEFAULT 0,\n      lockout_timestamp TEXT,\n      deletion_timestamp TEXT\2'
content = re.sub(students_table_re, replacement_table, content)

with open('server.ts', 'w') as f:
    f.write(content)
