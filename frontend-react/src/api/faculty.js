import { apiRequest } from "./client.js";

function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

const json = (method, body) => ({
  method,
  body: JSON.stringify(body),
});

export const facultyApi = {
  subjectCatalog: () => apiRequest("/api/subjects"),
  subjectStudents: (subjectId, date) =>
    apiRequest(`/api/attendance/students${queryString({ subject_id: subjectId, date })}`),
  studentProfile: (studentId) => apiRequest(`/api/students/${studentId}`),
  attendance: (filters = {}) =>
    apiRequest(`/api/attendance${queryString(filters)}`),
  saveAttendance: (data) =>
    apiRequest("/api/attendance", json("POST", data)),
  updateAttendance: (attendanceId, status) =>
    apiRequest(`/api/attendance/${attendanceId}`, json("PUT", { status })),
  classAttendanceReport: (filters) =>
    apiRequest(`/api/attendance/class-report${queryString(filters)}`),
  attendancePercentage: (studentId, subjectId) =>
    apiRequest(`/api/attendance/percentage/${studentId}/${subjectId}`),
  marks: (filters = {}) =>
    apiRequest(`/api/marks/${queryString(filters)}`),
  saveMark: (data) => apiRequest("/api/marks/", json("POST", data)),
  updateMark: (markId, data) =>
    apiRequest(`/api/marks/${markId}`, json("PUT", data)),
  marksSummary: (subjectId) =>
    apiRequest(`/api/marks/summary${queryString({ subject_id: subjectId })}`),
};
