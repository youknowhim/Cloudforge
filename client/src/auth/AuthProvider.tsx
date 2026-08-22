import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { login as loginRequest, signup as signupRequest } from "../services/api";

import {
  clearSession,
  isTokenExpired,
  readToken,
  readUser,
  saveSession,
  SESSION_EXPIRED_EVENT,
} from "../services/session";

import { clearPendingUploads } from "../lib/pendingUploads";

import type { AuthUser, Credentials, SignupPayload } from "../types/auth";

import { AuthContext, type AuthStatus } from "./AuthContext";

/*
  localStorage is synchronous, so a stored session is restored during the
  very first render — no loading flash, no redirect flicker.
*/
const restoreSession = (): { user: AuthUser | null; status: AuthStatus } => {
  const token = readToken();
  const storedUser = readUser();

  if (!token || !storedUser || isTokenExpired(token)) {
    clearSession();

    return { user: null, status: "guest" };
  }

  return { user: storedUser, status: "authenticated" };
};

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState(restoreSession);

  const { user, status } = session;

  const signOut = useCallback(() => {
    clearSession();

    /* sessionStorage outlives the session, so empty it explicitly */
    clearPendingUploads();

    setSession({ user: null, status: "guest" });
  }, []);

  /* any 401 anywhere in the app lands here */
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, signOut);

    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, signOut);
  }, [signOut]);

  const signIn = useCallback(async (credentials: Credentials) => {
    const { token, user: signedIn } = await loginRequest(credentials);

    saveSession(token, signedIn);
    setSession({ user: signedIn, status: "authenticated" });
  }, []);

  /*
    Signup returns the created user but no token, so we exchange the
    same credentials for one straight away and land the user inside.
  */
  const register = useCallback(
    async (payload: SignupPayload) => {
      await signupRequest(payload);

      await signIn({
        email: payload.email,
        password: payload.password,
      });
    },
    [signIn]
  );

  const value = useMemo(
    () => ({ user, status, signIn, register, signOut }),
    [user, status, signIn, register, signOut]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export default AuthProvider;
