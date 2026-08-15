import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "./useAuth";

/* Gate for everything that needs a signed-in user. */
export const RequireAuth = () => {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

/* Keeps signed-in users out of the login / signup screens. */
export const RedirectIfAuthed = () => {
  const { status } = useAuth();

  if (status === "authenticated") {
    return <Navigate to="/files" replace />;
  }

  return <Outlet />;
};
