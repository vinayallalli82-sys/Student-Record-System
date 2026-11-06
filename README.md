# Student-Record-System

## Administrator assignment management

Administrators can assign active Faculty accounts to subjects in the subject's
configured semester, then allocate students to those subjects. The semester ID
is validated against the subject and is derived from the existing
`subjects.semester_id` relationship; no duplicate semester-assignment table is
needed. An allocation is available only when the subject has an active Faculty
assignment.

The Administrator-only APIs are:

- `GET /api/admin/students` and `GET /api/admin/semesters` for allocation options.
- `GET|POST /api/admin/faculty-assignments`, `PUT
  /api/admin/faculty-assignments/<faculty_id>/<subject_id>`, and
  `DELETE /api/admin/faculty-assignments/<faculty_id>/<subject_id>`.
- `GET|POST /api/admin/student-allocations`,
  `PUT /api/admin/student-allocations/<student_id>/<subject_id>`, and
  `DELETE /api/admin/student-allocations/<student_id>/<subject_id>`.

Reassigning or removing an allocation changes only the relevant
`faculty_subjects` or `student_subjects` row. Attendance and marks are not
deleted or moved, so they remain tied to their original student and subject.