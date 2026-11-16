export default function SemesterSelect({
  semesters,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <div className="w-full max-w-xs space-y-1.5">
      <label className="block text-sm font-medium text-slate-700" htmlFor="student-semester">
        Semester
      </label>
      <select
        className="form-control"
        disabled={disabled || semesters.length === 0}
        id="student-semester"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {semesters.length === 0 ? (
          <option value="">No semesters available</option>
        ) : (
          semesters.map((semester) => (
            <option key={semester.semester_id} value={String(semester.semester_id)}>
              Semester {semester.semester_number} · {semester.academic_year}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
