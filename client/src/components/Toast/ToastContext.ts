import { createContext } from "react";

export type ToastTone = "info" | "success" | "error";

export interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
