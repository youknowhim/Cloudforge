import type { AuthUser } from "../types/auth";

const TOKEN_KEY = "token";
const USER_KEY = "user";

/*
  Broadcast when a token is rejected or expires, so the auth provider can
  drop the session no matter which component triggered the request.
*/
export const SESSION_EXPIRED_EVENT = "cloudforge:session-expired";

interface JwtPayload {
  sub?: string;
  email?: string;
  exp?: number;
}

export const decodeToken = (token: string): JwtPayload | null => {
  try {
    const payload = token.split(".")[1];

    if (!payload) return null;

    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));

    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

/* 30s of slack so we don't fire a request that dies in flight */
export const isTokenExpired = (token: string): boolean => {
  const exp = decodeToken(token)?.exp;

  if (!exp) return false;

  return Date.now() >= exp * 1000 - 30_000;
};

export const readToken = (): string | null =>
  localStorage.getItem(TOKEN_KEY);

export const readUser = (): AuthUser | null => {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const saveSession = (token: string, user: AuthUser): void => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const notifySessionExpired = (): void => {
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};
