import { apiRequest } from "./client.js";

const json = (method, body) => ({
  method,
  body: JSON.stringify(body),
});

export const adminApi = {
  users: () => apiRequest("/api/admin/users"),
  createUser: (data) => apiRequest("/api/admin/users", json("POST", data)),
  updateUser: (id, data) =>
    apiRequest(`/api/admin/users/${id}`, json("PATCH", data)),

  students: () => apiRequest("/api/admin/students"),
  orphanStudentAccounts: () => apiRequest("/api/admin/students/orphan-accounts"),
  createStudentProfile: (userId, data) =>
    apiRequest(`/api/admin/students/${userId}/profile`, json("POST", data)),
  student: (id) => apiRequest(`/api/students/${id}`),

  subjects: () => apiRequest("/api/subjects"),
  createSubject: (data) => apiRequest("/api/subjects", json("POST", data)),
  updateSubject: (id, data) =>
    apiRequest(`/api/subjects/${id}`, json("PUT", data)),

  semesters: () => apiRequest("/api/admin/semesters"),
  createSemester: (data) => apiRequest("/api/admin/semesters", json("POST", data)),

  facultyAssignments: () => apiRequest("/api/admin/faculty-assignments"),
  assignFaculty: (data) =>
    apiRequest("/api/admin/faculty-assignments", json("POST", data)),
  reassignFaculty: (facultyId, subjectId, data) =>
    apiRequest(
      `/api/admin/faculty-assignments/${facultyId}/${subjectId}`,
      json("PUT", data),
    ),
  removeFaculty: (facultyId, subjectId) =>
    apiRequest(
      `/api/admin/faculty-assignments/${facultyId}/${subjectId}`,
      { method: "DELETE" },
    ),

  studentAllocations: (filters = {}) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const suffix = query.size ? `?${query.toString()}` : "";
    return apiRequest(`/api/admin/student-allocations${suffix}`);
  },
  allocateStudent: (data) =>
    apiRequest("/api/admin/student-allocations", json("POST", data)),
  reassignStudent: (studentId, subjectId, data) =>
    apiRequest(
      `/api/admin/student-allocations/${studentId}/${subjectId}`,
      json("PUT", data),
    ),
  removeStudent: (studentId, subjectId) =>
    apiRequest(
      `/api/admin/student-allocations/${studentId}/${subjectId}`,
      { method: "DELETE" },
    ),
};
