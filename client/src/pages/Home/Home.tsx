import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import Icon, { type IconName } from "../../components/Icon/Icon";

import "./Home.css";

const STEPS: { icon: IconName; label: string; note: string }[] = [
  { icon: "upload", label: "Add a file", note: "drag it in, or browse" },
  { icon: "edit", label: "Give it a name", note: "so you can find it later" },
  { icon: "lock", label: "Keep it private", note: "only you can see it" },
  { icon: "users", label: "Share when ready", note: "one switch, any time" },
];

const FEATURES: { icon: IconName; title: string; copy: string }[] = [
  {
    icon: "lock",
    title: "Private until you say so",
    copy: "Everything you add is visible to you and nobody else. Share a file when you want to, and stop sharing it just as easily.",
  },
  {
    icon: "search",
    title: "One search for everything",
    copy: "Type once and see matches in your own files and in the files people have shared with you — no hunting through two places.",
  },
  {
    icon: "shield",
    title: "Safe to hand over",
    copy: "Share links stop working after fifteen minutes, so a file you passed along today isn't still open next month.",
  },
];

const Home = () => {
  const { status } = useAuth();

  const signedIn = status === "authenticated";

  return (
    <main className="page home">
      <section className="hero shell">
        <div className="hero-copy">
          <span className="hero-badge">
            <Icon name="cloud" size={14} />
            Somewhere to keep your files
          </span>

          <h1>
            Keep your files.
            <br />
            Share only what you mean to.
          </h1>

          <p>
            A private space for everything you upload, and a shared space for
            what your team passes around — with one search box that looks in
            both.
          </p>

          <div className="hero-actions">
            {signedIn ? (
              <>
                <Link to="/files" className="btn btn--primary btn--lg">
                  Open your files
                  <Icon name="arrowRight" size={16} />
                </Link>

                <Link to="/upload" className="btn btn--lg">
                  <Icon name="upload" size={16} />
                  Upload a file
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup" className="btn btn--primary btn--lg">
                  Create an account
                  <Icon name="arrowRight" size={16} />
                </Link>

                <Link to="/login" className="btn btn--lg">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="hero-mock" aria-hidden="true">
          <div className="mock-window">
            <div className="mock-toolbar">
              <div className="mock-tabs">
                <span className="mock-tab mock-tab--on">My files</span>
                <span className="mock-tab">Shared with me</span>
              </div>

              <div className="mock-search">
                <Icon name="search" size={13} />
                report
              </div>
            </div>

            <div className="mock-grid">
              {[
                { name: "Q3 report", meta: "PDF · 1.8 MB", tone: "var(--k-doc)", icon: "file" },
                { name: "Launch shot", meta: "PNG · 620 KB", tone: "var(--k-image)", icon: "image" },
                { name: "Handoff", meta: "ZIP · 14 MB", tone: "var(--k-archive)", icon: "archive" },
                { name: "Standup", meta: "MP4 · 42 MB", tone: "var(--k-video)", icon: "video" },
              ].map((item) => (
                <div key={item.name} className="mock-card">
                  <span
                    className="file-glyph file-glyph--sm"
                    style={{ "--tone": item.tone } as CSSProperties}
                  >
                    <Icon name={item.icon as IconName} size={15} />
                  </span>

                  <strong>{item.name}</strong>
                  <span>{item.meta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="pipeline shell" aria-label="How it works">
        {STEPS.map((step, index) => (
          <div key={step.label} className="pipeline-step">
            <span className="pipeline-icon">
              <Icon name={step.icon} size={16} />
            </span>

            <div>
              <strong>{step.label}</strong>
              <span>{step.note}</span>
            </div>

            {index < STEPS.length - 1 && (
              <Icon name="chevronRight" size={15} className="pipeline-arrow" />
            )}
          </div>
        ))}
      </section>

      <section className="features shell">
        {FEATURES.map((feature) => (
          <article key={feature.title} className="feature card">
            <span className="feature-icon">
              <Icon name={feature.icon} size={17} />
            </span>

            <h3>{feature.title}</h3>

            <p>{feature.copy}</p>
          </article>
        ))}
      </section>

      <footer className="home-footer">
        <div className="shell">
          <span>CloudForge</span>

          <span>Your files, private by default.</span>
        </div>
      </footer>
    </main>
  );
};

export default Home;
