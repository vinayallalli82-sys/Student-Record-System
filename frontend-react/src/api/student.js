import { apiDownload, apiRequest } from "./client.js";

export const studentApi = {
  profile: (semesterId) =>
    apiRequest(`/api/students/me${semesterId ? `?semester_id=${encodeURIComponent(semesterId)}` : ""}`),
  semesters: () => apiRequest("/api/students/me/semesters"),
  subjectCatalog: () => apiRequest("/api/subjects"),
  attendance: (semesterId) =>
    apiRequest(`/api/attendance/my${semesterId ? `?semester_id=${encodeURIComponent(semesterId)}` : ""}`),
  attendancePercentage: (studentId, subjectId) =>
    apiRequest(`/api/attendance/percentage/${studentId}/${subjectId}`),
  notifications: () => apiRequest("/api/notifications"),
  cgpa: (studentId) => apiRequest(`/api/students/${studentId}/cgpa`),
  academicRecords: (semester) =>
    apiRequest(`/api/academic-records/my?semester=${encodeURIComponent(semester)}`),
  downloadAcademicRecords: (semester) =>
    apiDownload(`/api/academic-records/download?semester=${encodeURIComponent(semester)}`),
};
