import re

with open('server.ts', 'r') as f:
    content = f.read()

# 1. Update CREATE TABLE IF NOT EXISTS students
students_table_re = r'(CREATE TABLE IF NOT EXISTS students \([\s\S]*?)(exam_eligibility TEXT)(\s*\);)'
replacement_table = r'\1\2,\n      has_changed_password INTEGER DEFAULT 0,\n      password_change_count INTEGER DEFAULT 0,\n      failed_attempts INTEGER DEFAULT 0,\n      lockout_timestamp TEXT,\n      deletion_timestamp TEXT\3'
content = re.sub(students_table_re, replacement_table, content)

# 2. Add migrations
migrations_re = r'(try \{ db\.run\("ALTER TABLE academic_years ADD COLUMN semester2 TEXT"\); \} catch \(e\) \{\})'
replacement_migrations = r'\1\n  try { db.run("ALTER TABLE students ADD COLUMN has_changed_password INTEGER DEFAULT 0"); } catch (e) {}\n  try { db.run("ALTER TABLE students ADD COLUMN password_change_count INTEGER DEFAULT 0"); } catch (e) {}\n  try { db.run("ALTER TABLE students ADD COLUMN failed_attempts INTEGER DEFAULT 0"); } catch (e) {}\n  try { db.run("ALTER TABLE students ADD COLUMN lockout_timestamp TEXT"); } catch (e) {}\n  try { db.run("ALTER TABLE students ADD COLUMN deletion_timestamp TEXT"); } catch (e) {}'
content = re.sub(migrations_re, replacement_migrations, content)

# 3. Update the dbAll("SELECT * FROM students") map to convert the ints to booleans
select_students_re = r'(result\.students = dbAll\("SELECT \* FROM students"\)\.map\(s => \{\n[\s\S]*?return \{[\s\S]*?examEligibility: parsedEligibility)(\n\s*\};\n\s*\}\);)'
replacement_select = r'\1,\n          hasChangedPassword: Boolean(s.has_changed_password),\n          passwordChangeCount: s.password_change_count || 0,\n          failedAttempts: s.failed_attempts || 0,\n          lockoutTimestamp: s.lockout_timestamp || undefined,\n          deletionTimestamp: s.deletion_timestamp || undefined\2'
content = re.sub(select_students_re, replacement_select, content)

# 4. Update txRun("INSERT OR REPLACE INTO students")
insert_re = r'(txRun\("INSERT OR REPLACE INTO students \(id, name, faculty, department, semester, email, phone_number, phone_number_2, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, profile_picture, gender, date_of_birth, address, exam_eligibility) \) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)",'
replacement_insert = r'\1, has_changed_password, password_change_count, failed_attempts, lockout_timestamp, deletion_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",'
content = re.sub(insert_re, replacement_insert, content)

# 5. Update the params for txRun
params_re = r'(JSON\.stringify\(s\.examEligibility \|\| s\.exam_eligibility \|\| \[\'EXAM-2024-SPR\'\]\))(\n\s*\]\);)'
replacement_params = r'\1,\n                  s.hasChangedPassword || s.has_changed_password ? 1 : 0,\n                  s.passwordChangeCount || s.password_change_count || 0,\n                  s.failedAttempts || s.failed_attempts || 0,\n                  s.lockoutTimestamp || s.lockout_timestamp || null,\n                  s.deletionTimestamp || s.deletion_timestamp || null\2'
content = re.sub(params_re, replacement_params, content)

with open('server.ts', 'w') as f:
    f.write(content)
