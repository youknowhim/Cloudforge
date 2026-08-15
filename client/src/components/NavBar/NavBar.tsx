import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import { initialsOf } from "../../lib/format";
import Icon from "../Icon/Icon";

import "./NavBar.css";

const LINKS = [
  { to: "/files", label: "Files" },
  { to: "/upload", label: "Upload" },
];

const NavBar = () => {
  const { user, status, signOut } = useAuth();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  /* hairline turns into a shadow once the page moves */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleSignOut = () => {
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <header className={`navbar${scrolled ? " navbar--raised" : ""}`}>
      <div className="navbar-inner shell">
        <Link to="/" className="brand" aria-label="CloudForge home">
          <span className="brand-mark">
            <Icon name="cloud" size={17} strokeWidth={1.8} />
          </span>

          <span className="brand-name">CloudForge</span>
        </Link>

        {status === "authenticated" && (
          <nav className="nav-links" aria-label="Main">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `nav-link${isActive ? " nav-link--active" : ""}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="navbar-right">
          {status === "authenticated" ? (
            <>
              <Link to="/upload" className="btn btn--primary btn--sm nav-cta">
                <Icon name="plus" size={15} strokeWidth={2} />
                <span>New upload</span>
              </Link>

              <div className="user-menu" ref={menuRef}>
                <button
                  type="button"
                  className="avatar-button"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <span className="avatar">{initialsOf(user?.name)}</span>

                  <Icon
                    name="chevronDown"
                    size={14}
                    className={`avatar-caret${menuOpen ? " is-open" : ""}`}
                  />
                </button>

                {menuOpen && (
                  <div className="menu" role="menu">
                    <div className="menu-identity">
                      <strong>{user?.name}</strong>
                      <span>{user?.email}</span>
                    </div>

                    <hr className="divider" />

                    <Link
                      to="/files"
                      className="menu-item"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                    >
                      <Icon name="folder" size={16} />
                      My files
                    </Link>

                    <button
                      type="button"
                      className="menu-item menu-item--danger"
                      role="menuitem"
                      onClick={handleSignOut}
                    >
                      <Icon name="logout" size={16} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            status === "guest" && (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm">
                  Sign in
                </Link>

                <Link to="/signup" className="btn btn--primary btn--sm">
                  Create account
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
};

export default NavBar;
