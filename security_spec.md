# Firestore Security Specification & Security TDD Spec

## 1. Data Invariants
- **Admin Invariant**: Only authorized admins registered in the system (or matching designated admin claims) can read, create, or update general student lists, notices, or change attendance records.
- **Student Ownership**: A student can view their own profile, create their query requests, and view notice boards.
- **Attendance Integrity**: No student can create, update, or delete their own or other students' attendance records directly.
- **Notice Board Immutable Rules**: Only system administrators can publish notices. Students have read-only access to notices.

---

## 2. The "Dirty Dozen" Payloads

Here are 12 malicious payloads designed to violate system security:

1. **Self-Elevated Admin Profile Creation**
   - *Target*: `/admins/attacker_uid`
   - *Payload*: `{ "id": 9999, "username": "fake_admin", "passwordHash": "$2b$10$abcdef" }`
   - *Exploit*: Attacker tries to register themselves in the `admins` collection to elevate their role.

2. **Student Injecting Extreme Length PIN ID**
   - *Target*: `/students/long_pin_id`
   - *Payload*: `{ "id": 12, "pin": "A".repeat(500), "name": "Hack", "rollNumber": "1", "regNumber": "1", "semester": 1 }`
   - *Exploit*: Denial-of-wallet or validation poisoning with an extremely long PIN.

3. **Student Profile Hijacking**
   - *Target*: `/students/legit_student_id` (not belonging to current student)
   - *Payload*: `{ "name": "Manipulated Name", "email": "evil@hacker.com" }`
   - *Exploit*: Attempting to edit another student's profile information.

4. **Shadow Field Injection (Student Update)**
   - *Target*: `/students/legit_student_id`
   - *Payload*: `{ "id": 1, "pin": "123", "name": "Student", "rollNumber": "1", "regNumber": "1", "semester": 1, "custom_isAdmin": true }`
   - *Exploit*: Injecting unmapped/ghost properties into a valid student record.

5. **Direct Attendance Logging by Student**
   - *Target*: `/attendance/random_id`
   - *Payload*: `{ "id": 99, "studentId": 1, "date": "2026-06-30", "subject": "CN", "status": "present" }`
   - *Exploit*: Student attempting to log their own attendance as present.

6. **Forged Notice Posting**
   - *Target*: `/notices/new_notice`
   - *Payload*: `{ "id": 5, "title": "Classes Suspended", "content": "All classes are suspended forever.", "date": "2026-06-30" }`
   - *Exploit*: Student attempting to publish fake notifications.

7. **Bypassing Setting Lock Status**
   - *Target*: `/settings/signup_lock_password`
   - *Payload*: `{ "key": "signup_lock_password", "value": "" }`
   - *Exploit*: Unauthenticated user attempting to unlock student signup gates.

8. **Illegal State Shortcutting in Support Requests**
   - *Target*: `/requests/request_id`
   - *Payload*: `{ "status": "approved" }` (by student owner)
   - *Exploit*: Student attempts to self-approve an attendance query/request.

9. **Injecting 1MB Payload into Notice Title**
   - *Target*: `/notices/new_notice`
   - *Payload*: `{ "id": 6, "title": "B".repeat(1000000), "content": "Test Content", "date": "2026-06-30" }`
   - *Exploit*: Attempt to bloat Firestore storage and cause Denial of Wallet.

10. **Creating Sibling Request Without Student Record (Orphaned Write)**
    - *Target*: `/requests/request_id_nonexistent`
    - *Payload*: `{ "id": 7, "studentId": 99999, "date": "2026-06-30", "subject": "Math", "message": "Help!", "status": "pending" }`
    - *Exploit*: Creating support request associated with a non-existent student.

11. **Bypassing Terminal Notice Lock**
    - *Target*: `/requests/resolved_request_id` (where status is "approved")
    - *Payload*: `{ "status": "pending", "message": "Change after decision" }`
    - *Exploit*: Attempting to modify or reopen a request that reached terminal status.

12. **Malicious Empty Query Scraping (Denial of Wallet)**
    - *Target*: `/students`
    - *Query*: Fetch all students without filters using blanket permission.
    - *Exploit*: Student attempting to scrape other students' personal detail databases.

---

## 3. Test Runner Specification
The test suite `firestore.rules.test.ts` executes assertions verifying that:
1. Admin credentials and setup cannot be self-written.
2. Students can read/write only their own requests and profile.
3. Every single operation that violates the above "Dirty Dozen" returns `PERMISSION_DENIED` with absolute consistency.
