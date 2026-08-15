import { Link } from "react-router-dom";
import type { ReactNode } from "react";

import Icon from "../../components/Icon/Icon";

import "./Auth.css";

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

const HIGHLIGHTS = [
  {
    icon: "lock",
    title: "Private by default",
    copy: "Everything you add is yours alone until you decide to share it.",
  },
  {
    icon: "users",
    title: "Share in one click",
    copy: "Let the team see a file, and take it back whenever you want.",
  },
  {
    icon: "search",
    title: "Find it in one search",
    copy: "Your files and the ones shared with you turn up together.",
  },
] as const;

const AuthLayout = ({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) => (
  <main className="auth">
    <section className="auth-panel">
      <div className="auth-panel-inner">
        <Link to="/" className="brand auth-brand">
          <span className="brand-mark">
            <Icon name="cloud" size={17} strokeWidth={1.8} />
          </span>

          <span className="brand-name">CloudForge</span>
        </Link>

        <header className="auth-head">
          <p className="eyebrow">{eyebrow}</p>

          <h1>{title}</h1>

          <p className="auth-sub">{subtitle}</p>
        </header>

        {children}

        <p className="auth-footer">{footer}</p>
      </div>
    </section>

    <aside className="auth-aside" aria-hidden="true">
      <div className="auth-aside-inner">
        <div className="auth-mock">
          <div className="auth-mock-bar">
            <span />
            <span />
            <span />
          </div>

          <div className="auth-mock-body">
            <div className="auth-mock-search">
              <Icon name="search" size={14} />
              <span>quarterly report</span>
            </div>

            {[
              { name: "quarterly-report.pdf", meta: "1.8 MB · Yours", tone: "var(--k-doc)" },
              { name: "cover-photo.png", meta: "620 KB · Shared", tone: "var(--k-image)" },
              { name: "holiday-pics.zip", meta: "14 MB · Yours", tone: "var(--k-archive)" },
            ].map((row) => (
              <div key={row.name} className="auth-mock-row">
                <span
                  className="auth-mock-icon"
                  style={{ color: row.tone }}
                >
                  <Icon name="file" size={15} />
                </span>

                <span className="auth-mock-name">{row.name}</span>

                <span className="auth-mock-meta">{row.meta}</span>
              </div>
            ))}
          </div>
        </div>

        <ul className="auth-highlights">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title}>
              <span className="auth-highlight-icon">
                <Icon name={item.icon} size={16} />
              </span>

              <div>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  </main>
);

export default AuthLayout;
