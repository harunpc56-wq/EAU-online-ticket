import re

with open('App.tsx', 'r') as f:
    content = f.read()

# 1. Update the student login check
old_student_login = r"(\} else if \(student\.status === AccountStatus\.DELETED\) \{\s*setError\('Identity record archived in history\.'\);\s*\}) else if \(student\.password === password\) \{\s*if \(student\.passwordResetByAdmin\) \{\s*setResetMessage\('Your previous password was reset by the administrator\.'\);\s*\}\s*triggerOtp\(\{ user: student, role: UserRole\.STUDENT \}\);\s*\} else \{\s*setError\('Credential Mismatch\.'\);\s*\}"

new_student_login = r"""\1 else {
               let passwordMatches = false;
               try {
                 if (student.passwordHash && bcrypt.compareSync(password, student.passwordHash)) {
                   passwordMatches = true;
                 } else if (student.password && student.password === password) {
                   passwordMatches = true;
                 }
               } catch (e) {
                 if (student.password && student.password === password) {
                   passwordMatches = true;
                 }
               }
               if (passwordMatches) {
                 if (student.passwordResetByAdmin) {
                   setResetMessage('Your previous password was reset by the administrator.');
                 }
                 triggerOtp({ user: student, role: UserRole.STUDENT });
               } else {
                 setError('Credential Mismatch.');
               }
             }"""

content = re.sub(old_student_login, new_student_login, content)


# 2. Update the student password change logic
old_password_change = r"const updated = \{\s*\.\.\.student,\s*password: newPassword,\s*hasChangedPassword: true,\s*passwordResetByAdmin: false,\s*passwordChangeCount: \(student\.passwordChangeCount \|\| 0\) \+ 1,\s*failedAttempts: 0\s*\};"
new_password_change = r"""const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);
      const updated = { 
         ...student, 
         password: '', // Remove plain text password for security
         passwordHash: passwordHash,
         hasChangedPassword: true, 
         passwordResetByAdmin: false, 
         passwordChangeCount: (student.passwordChangeCount || 0) + 1,
         failedAttempts: 0 
       };"""

content = re.sub(old_password_change, new_password_change, content)

with open('App.tsx', 'w') as f:
    f.write(content)

