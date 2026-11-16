import { useCallback } from "react";
import { ApiError } from "../api/client.js";
import { facultyApi } from "../api/faculty.js";
import useAdminQuery from "./useAdminQuery.js";

export default function useFacultyWorkspace() {
  const query = useCallback(async () => {
    const catalog = await facultyApi.subjectCatalog();
    if (!Array.isArray(catalog)) {
      throw new Error("The subject catalog API returned an unexpected response.");
    }

    const checkedSubjects = await Promise.all(
      catalog.map(async (subject) => {
        try {
          const students = await facultyApi.subjectStudents(subject.subject_id);
          if (!Array.isArray(students)) {
            throw new Error("The enrolled-students API returned an unexpected response.");
          }
          return { ...subject, students };
        } catch (error) {
          if (error instanceof ApiError && error.status === 403) return null;
          throw error;
        }
      }),
    );

    return checkedSubjects.filter(Boolean);
  }, []);

  return useAdminQuery(query);
}
