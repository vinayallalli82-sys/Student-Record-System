import { useCallback } from "react";
import { studentApi } from "../api/student.js";
import useAdminQuery from "./useAdminQuery.js";

export default function useStudentProfile(semesterId) {
  const query = useCallback(async () => {
    if (semesterId === "") return { subjects: [], selectedSemesterId: "" };
    const profile = await studentApi.profile(semesterId || undefined);
    if (!profile || !Array.isArray(profile.subjects)) {
      throw new Error("The student profile API returned an unexpected response.");
    }
    return semesterId == null
      ? profile
      : { ...profile, selectedSemesterId: String(semesterId) };
  }, [semesterId]);

  return useAdminQuery(query);
}
