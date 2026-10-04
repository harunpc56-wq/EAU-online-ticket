import re

with open('components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

old_state = "name: '', phoneNumber: '', faculty: '', department: '', semester: '',\\n        email: '', status: AccountStatus.ACTIVE, examEligibility: [], scholarships: []"
new_state = "name: '', phoneNumber: '', faculty: '', department: '', semester: '', academicYear: '',\\n        email: '', status: AccountStatus.ACTIVE, examEligibility: [], scholarships: []"
content = content.replace(old_state, new_state)

# Let's find the student modal inputs
# We need to add an input for academicYear
# Let's see what's after semester
