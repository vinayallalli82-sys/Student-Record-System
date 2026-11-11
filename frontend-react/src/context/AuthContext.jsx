import { useCallback, useEffect, useMemo, useState } from "react";
import { authApi, setUnauthorizedHandler } from "../api/client.js";
import { AuthContext } from "./authContext.js";

const LOGIN_SESSION_KEY = "student-record-login-session";

function createLoginSessionId() {
  return globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clearLoginSession() {
  const sessionId = sessionStorage.getItem(LOGIN_SESSION_KEY);
  if (sessionId) sessionStorage.removeItem(`student-notifications-checked:${sessionId}`);
  sessionStorage.removeItem(LOGIN_SESSION_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [loginSessionId, setLoginSessionId] = useState(null);

  const handleUnauthorized = useCallback(() => {
    setUser(null);
    setLoginSessionId(null);
    clearLoginSession();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(handleUnauthorized);
    let active = true;

    authApi
      .currentUser()
      .then((currentUser) => {
        if (active) {
          setUser(currentUser);
          if (currentUser.role === "Student") {
            let sessionId = sessionStorage.getItem(LOGIN_SESSION_KEY);
            if (!sessionId) {
              sessionId = createLoginSessionId();
              sessionStorage.setItem(LOGIN_SESSION_KEY, sessionId);
            }
            setLoginSessionId(sessionId);
          } else {
            clearLoginSession();
            setLoginSessionId(null);
          }
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setLoginSessionId(null);
          clearLoginSession();
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      setUnauthorizedHandler(() => {});
    };
  }, [handleUnauthorized]);

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password);
    if (!result?.user) {
      throw new Error("The server did not return authenticated user details.");
    }
    setUser(result.user);
    if (result.user.role === "Student") {
      const sessionId = createLoginSessionId();
      sessionStorage.setItem(LOGIN_SESSION_KEY, sessionId);
      setLoginSessionId(sessionId);
    } else {
      clearLoginSession();
      setLoginSessionId(null);
    }
    setNotice({ type: "success", message: "You are signed in." });
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setLoginSessionId(null);
    clearLoginSession();
    setNotice({ type: "success", message: "You have signed out." });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loginSessionId,
      isLoading,
      notice,
      login,
      logout,
      setNotice,
      clearNotice: () => setNotice(null),
    }),
    [user, loginSessionId, isLoading, notice, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
