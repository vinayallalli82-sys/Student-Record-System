import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

const ROLE_HOME = {
  Administrator: "/admin",
  Faculty: "/faculty",
  Student: "/student",
};

export default function RoleLandingRedirect() {
  const { user } = useAuth();
  return <Navigate to={ROLE_HOME[user?.role] || "/unauthorized"} replace />;
}
