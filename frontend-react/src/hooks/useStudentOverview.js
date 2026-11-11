import { useCallback } from "react";
import { studentApi } from "../api/student.js";
import useAdminQuery from "./useAdminQuery.js";

async function loadEndpoint(request, validate, emptyValue) {
  try {
    const data = await request();
    if (!validate(data)) throw new Error("The API returned an unexpected response.");
    return { data, error: "" };
  } catch (error) {
    return { data: emptyValue, error: error.message || "Unable to load this information." };
  }
}

export default function useStudentOverview() {
  const query = useCallback(async () => {
    const [profile, attendance, notifications] = await Promise.all([
      loadEndpoint(studentApi.profile, (data) => data?.student_id && Array.isArray(data.subjects), null),
      loadEndpoint(studentApi.attendance, Array.isArray, []),
      loadEndpoint(studentApi.notifications, Array.isArray, []),
    ]);
    const cgpa = profile.data
      ? await loadEndpoint(studentApi.cgpa.bind(null, profile.data.student_id), (data) => data?.status === "success", null)
      : { data: null, error: profile.error || "No student profile is linked to this account." };
    return { profile, attendance, notifications, cgpa };
  }, []);

  return useAdminQuery(query);
}
