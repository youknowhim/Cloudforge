import { BrowserRouter, Link, Outlet, Route, Routes } from "react-router-dom";

import AuthProvider from "./auth/AuthProvider";
import { RedirectIfAuthed, RequireAuth } from "./auth/RouteGuards";

import NavBar from "./components/NavBar/NavBar";
import ToastProvider from "./components/Toast/ToastProvider";

import Home from "./pages/Home/Home";
import Login from "./pages/Auth/Login";
import Signup from "./pages/Auth/Signup";
import Files from "./pages/Files/Files";
import Upload from "./pages/Upload/Upload";

import "./App.css";

const AppLayout = () => (
  <>
    <NavBar />
    <Outlet />
  </>
);

const NotFound = () => (
  <main className="page not-found">
    <div className="shell">
      <p className="eyebrow">Error 404</p>

      <h1>We couldn't find that page</h1>

      <p>
        The link may be broken, or the page may have been moved since you last
        saw it.
      </p>

      <Link to="/" className="btn btn--primary">
        Back to home
      </Link>
    </div>
  </main>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ToastProvider>
        <Routes>
          {/* public, chrome-free auth screens */}
          <Route element={<RedirectIfAuthed />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />

            <Route element={<RequireAuth />}>
              <Route path="/files" element={<Files />} />
              <Route path="/upload" element={<Upload />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
