import re

with open('components/StudentRegistrationForm.tsx', 'r') as f:
    content = f.read()

# 1. Update password initialization
# const [password, setPassword] = useState<string>(studentToEdit?.password || `${studentToEdit?.id || nextGeneratedId}123`);
# Instead, we should check if they have a password, otherwise empty.
old_init = r'const \[password, setPassword\] = useState<string>\(studentToEdit\?\.password \|\| `\$\{studentToEdit\?\.id \|\| nextGeneratedId\}123`\);'
new_init = r"const [password, setPassword] = useState<string>(studentToEdit ? (studentToEdit.password || '') : `${nextGeneratedId}123`);"
content = re.sub(old_init, new_init, content)

# 2. Update validation to not require password if editing and they already have a hash
old_val = r"(if \(!password\.trim\(\)\) \{\s*errs\.password = 'Initial password is required';\s*\})"
new_val = r"if (!password.trim() && !(isEditing && studentToEdit?.passwordHash)) { errs.password = 'Initial password is required'; }"
content = re.sub(old_val, new_val, content)

# 3. Update the form submission object
old_submit = r"(status,\s*password: password\.trim\(\),\s*passwordHash: password\.trim\(\),)"
new_submit = r"status,\n        password: password.trim() ? password.trim() : (studentToEdit?.password || ''),\n        passwordHash: password.trim() ? password.trim() : (studentToEdit?.passwordHash || ''),"
content = re.sub(old_submit, new_submit, content)

with open('components/StudentRegistrationForm.tsx', 'w') as f:
    f.write(content)
