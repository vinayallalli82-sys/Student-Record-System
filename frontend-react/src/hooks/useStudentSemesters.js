import { useCallback, useEffect, useState } from "react";
import { studentApi } from "../api/student.js";
import useAdminQuery from "./useAdminQuery.js";

export default function useStudentSemesters() {
  const query = useCallback(async () => {
    const result = await studentApi.semesters();
    if (!result || !Array.isArray(result.semesters)) {
      throw new Error("The student semesters API returned an unexpected response.");
    }
    return result;
  }, []);
  const { data, error, isLoading, reload } = useAdminQuery(query);
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  useEffect(() => {
    if (!data) return;
    const availableIds = data.semesters.map((semester) => String(semester.semester_id));
    if (availableIds.includes(String(selectedSemesterId))) return;
    const initialId = data.latest_semester_id ?? data.semesters[0]?.semester_id;
    setSelectedSemesterId(initialId == null ? "" : String(initialId));
  }, [data, selectedSemesterId]);

  return {
    semesters: data?.semesters || [],
    selectedSemesterId,
    setSelectedSemesterId,
    error,
    isLoading,
    reload,
  };
}
