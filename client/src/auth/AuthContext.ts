import { createContext } from "react";

import type {
  AuthUser,
  Credentials,
  SignupPayload,
} from "../types/auth";

export type AuthStatus = "authenticated" | "guest";

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (credentials: Credentials) => Promise<void>;
  register: (payload: SignupPayload) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
