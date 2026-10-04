import re

with open('server.ts', 'r') as f:
    content = f.read()

old_insert = r'txRun\("INSERT OR REPLACE INTO students \(id, name, faculty, department, semester, email, phone_number, phone_number_2, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, profile_picture, gender, date_of_birth, address, exam_eligibility\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)",'
new_insert = r'txRun("INSERT OR REPLACE INTO students (id, name, faculty, department, semester, email, phone_number, phone_number_2, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, profile_picture, gender, date_of_birth, address, exam_eligibility, has_changed_password, password_change_count, failed_attempts, lockout_timestamp, deletion_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",'

content = re.sub(old_insert, new_insert, content)

# I should also check the dummy student inserts!
old_dummy1 = r'dbRun\("INSERT INTO students \(id, name, faculty, department, semester, email, phone_number, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)",\n      \[\'EAUGRW0001\', \'Ali Farah\', \'Faculty of IT\', \'Computer Science\', \'6th Semester\', \'ali.farah@university.edu\', \'\+252610000000\', \'ACTIVE\', \'EAUGRW0001123\', 0, \'\[\]\', \'\[\]\', \'\', \'\'\]\);'

new_dummy1 = r'''dbRun("INSERT INTO students (id, name, faculty, department, semester, email, phone_number, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, has_changed_password, password_change_count, failed_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['EAUGRW0001', 'Ali Farah', 'Faculty of IT', 'Computer Science', '6th Semester', 'ali.farah@university.edu', '+252610000000', 'ACTIVE', 'EAUGRW0001123', 0, '[]', '[]', '', '', 0, 0, 0]);'''

content = re.sub(old_dummy1, new_dummy1, content)

old_dummy2 = r'dbRun\("INSERT INTO students \(id, name, faculty, department, semester, email, phone_number, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year\) VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?, \?\)",\n      \[\'EAUGRW0002\', \'Sara Ahmed\', \'Faculty of Business\', \'Business Administration\', \'4th Semester\', \'sara.ahmed@university.edu\', \'\+252611111111\', \'ACTIVE\', \'EAUGRW0002123\', 0, \'\[\]\', \'\[\]\', \'\', \'\'\]\);'

new_dummy2 = r'''dbRun("INSERT INTO students (id, name, faculty, department, semester, email, phone_number, status, password_hash, password_reset_by_admin, loans, scholarships, program, academic_year, has_changed_password, password_change_count, failed_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['EAUGRW0002', 'Sara Ahmed', 'Faculty of Business', 'Business Administration', '4th Semester', 'sara.ahmed@university.edu', '+252611111111', 'ACTIVE', 'EAUGRW0002123', 0, '[]', '[]', '', '', 0, 0, 0]);'''
content = re.sub(old_dummy2, new_dummy2, content)

with open('server.ts', 'w') as f:
    f.write(content)
