import { useState } from "react";
import { Download } from "lucide-react";
import { studentApi } from "../../api/student.js";
import Button from "../../components/common/Button.jsx";
import Card from "../../components/common/Card.jsx";
import { ErrorState } from "../../components/common/LoadingError.jsx";
import PageHeader from "../../components/common/PageHeader.jsx";

export default function StudentReportsPage() {
  const [semester, setSemester] = useState("");
  const [error, setError] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadReport(event) {
    event.preventDefault();
    const semesterNumber = Number(semester);
    if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
      setError("Enter a semester number from 1 to 12.");
      return;
    }

    setError("");
    setIsDownloading(true);
    try {
      const { blob, filename } = await studentApi.downloadAcademicRecords(semesterNumber);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-7">
      <PageHeader description="Download your academic report PDF from the existing student-only endpoint." eyebrow="STUDENT WORKSPACE" title="Download reports" />
      <Card>
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={downloadReport}>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700" htmlFor="report-semester">Semester number</label>
            <input
              className="form-control"
              id="report-semester"
              max="12"
              min="1"
              onChange={(event) => setSemester(event.target.value)}
              required
              type="number"
              value={semester}
            />
          </div>
          <Button disabled={isDownloading} type="submit">
            <Download aria-hidden="true" size={16} />
            {isDownloading ? "Preparing PDF..." : "Download academic report"}
          </Button>
        </form>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          The request uses your signed-in session and downloads a report for the semester number you enter. Available semesters are not listed by a student API.
        </p>
      </Card>
      {error && <ErrorState message={error} />}
    </div>
  );
}
