import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { describeFile } from "../../lib/fileKind";
import { formatBytes, formatRelative, initialsOf } from "../../lib/format";
import type { CloudFile } from "../../types/file";

import Highlight from "../Highlight/Highlight";
import Icon from "../Icon/Icon";

import "./FileCard.css";

export interface FileCardProps {
  file: CloudFile;
  view: "grid" | "list";
  isOwner: boolean;
  query?: string;
  downloading?: boolean;
  deleting?: boolean;
  onOpen: (file: CloudFile) => void;
  onDownload: (file: CloudFile) => void;
  onEdit: (file: CloudFile) => void;
  onDelete: (file: CloudFile) => void;
}

const nameOf = (email: string): string => email.split("@")[0];

/* "user1, user2 and 3 others" — the list stays one line at any length */
const summarise = (emails: string[]): string => {
  const names = emails.map(nameOf);

  if (names.length <= 2) return names.join(" and ");

  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} other${
    names.length - 2 === 1 ? "" : "s"
  }`;
};

const FileCard = ({
  file,
  view,
  isOwner,
  query = "",
  downloading = false,
  deleting = false,
  onOpen,
  onDownload,
  onEdit,
  onDelete,
}: FileCardProps) => {
  const kind = describeFile(file.mimeType, file.fileName);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const processing = file.status === "processing";
  const sharedWith = file.sharedWith ?? [];

  /* a card mid-delete stops responding but stays put until the API answers */
  const inert = deleting || processing;

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirming(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      setMenuOpen(false);
      setConfirming(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  /* the menu is meaningless on a row that isn't in the catalogue yet */
  useEffect(() => {
    if (processing) setMenuOpen(false);
  }, [processing]);

  const closeMenu = () => {
    setMenuOpen(false);
    setConfirming(false);
  };

  const run = (action: () => void) => () => {
    closeMenu();
    action();
  };

  const menu = (
    <div className="file-menu-wrap" ref={menuRef}>
      <button
        type="button"
        className="file-menu-trigger"
        aria-label={`Actions for ${file.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        disabled={inert}
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
          setConfirming(false);
        }}
      >
        <Icon name="more" size={18} strokeWidth={2.4} />
      </button>

      {menuOpen && (
        <div
          className="menu file-menu"
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          {confirming ? (
            <div className="file-menu-confirm">
              <strong>Move to trash?</strong>

              <p>It'll be gone for good — there's no undo.</p>

              <div className="file-menu-confirm-actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={closeMenu}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={run(() => onDelete(file))}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={run(() => onOpen(file))}
              >
                <Icon name="eye" size={16} />
                Open details
              </button>

              <button
                type="button"
                className="menu-item"
                role="menuitem"
                onClick={run(() => onDownload(file))}
              >
                <Icon name="download" size={16} />
                Download
              </button>

              {isOwner && (
                <>
                  <button
                    type="button"
                    className="menu-item"
                    role="menuitem"
                    onClick={run(() => onEdit(file))}
                  >
                    <Icon name="users" size={16} />
                    Share &amp; edit
                  </button>

                  <hr className="divider" />

                  <button
                    type="button"
                    className="menu-item menu-item--danger"
                    role="menuitem"
                    onClick={() => setConfirming(true)}
                  >
                    <Icon name="trash" size={16} />
                    Delete
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  /*
    The two halves of the API's answer. Owners see who they gave it to;
    everyone else sees who gave it to them.
  */
  const sharing = isOwner ? (
    sharedWith.length > 0 ? (
      <div className="file-share" title={sharedWith.join(", ")}>
        <span className="file-share-faces" aria-hidden="true">
          {sharedWith.slice(0, 3).map((email) => (
            <span key={email} className="file-face">
              {initialsOf(nameOf(email), email.slice(0, 2).toUpperCase())}
            </span>
          ))}
        </span>

        <span className="file-share-text">
          Shared with <strong>{summarise(sharedWith)}</strong>
        </span>
      </div>
    ) : (
      <div className="file-share file-share--private">
        <span className="file-face file-face--muted" aria-hidden="true">
          <Icon name="lock" size={12} strokeWidth={1.9} />
        </span>

        <span className="file-share-text">Private — only you</span>
      </div>
    )
  ) : (
    <div className="file-share" title={file.sharedBy?.email}>
      <span className="file-face file-face--owner" aria-hidden="true">
        {initialsOf(file.sharedBy?.name ?? file.sharedBy?.email)}
      </span>

      <span className="file-share-text">
        Shared by{" "}
        <strong>{file.sharedBy?.name || file.sharedBy?.email || "someone"}</strong>
      </span>
    </div>
  );

  const badges = (
    <>
      {processing && (
        <span className="badge badge--warn">
          <Icon name="spinner" size={12} strokeWidth={2} className="spin" />
          Processing
        </span>
      )}

      {file.status === "failed" && (
        <span className="badge badge--danger">
          <Icon name="alert" size={12} strokeWidth={1.9} />
          Failed
        </span>
      )}

      {isOwner && sharedWith.length > 0 && (
        <span className="badge badge--accent">
          <Icon name="users" size={12} strokeWidth={1.9} />
          {sharedWith.length}
        </span>
      )}
    </>
  );

  const openOnActivate = {
    role: "button" as const,
    tabIndex: 0,
    onClick: () => onOpen(file),
    onKeyDown: (event: ReactKeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      onOpen(file);
    },
  };

  const className = (base: string) =>
    `${base}${processing ? ` ${base}--processing` : ""}${
      deleting ? ` ${base}--deleting` : ""
    }`;

  if (view === "list") {
    return (
      <div className={className("file-row")} {...openOnActivate}>
        <span
          className="file-glyph file-glyph--sm"
          style={{ "--tone": kind.tone } as CSSProperties}
        >
          <Icon name={kind.icon} size={17} />
        </span>

        <div className="file-row-main">
          <h3>
            <Highlight text={file.title} query={query} />
          </h3>

          <span className="file-row-sub">{sharing}</span>
        </div>

        <div className="file-row-badges">{badges}</div>

        <span className="file-row-size num">{formatBytes(file.size)}</span>

        <span className="file-row-date">{formatRelative(file.createdAt)}</span>

        <div className="file-row-actions">
          {deleting ? (
            <span className="file-busy" aria-label="Deleting">
              <Icon name="spinner" size={16} strokeWidth={2} className="spin" />
            </span>
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--icon btn--sm"
              aria-label={`Download ${file.title}`}
              disabled={downloading || processing}
              onClick={(event) => {
                event.stopPropagation();
                onDownload(file);
              }}
            >
              <Icon
                name={downloading ? "spinner" : "download"}
                size={16}
                className={downloading ? "spin" : undefined}
              />
            </button>
          )}

          {menu}
        </div>
      </div>
    );
  }

  return (
    <article className={className("file-card")} {...openOnActivate}>
      <div className="file-card-head">
        <span
          className="file-glyph file-glyph--sm"
          style={{ "--tone": kind.tone } as CSSProperties}
        >
          <Icon name={kind.icon} size={16} />
        </span>

        <h3 className="file-card-title">
          <Highlight text={file.title} query={query} />
        </h3>

        {deleting ? (
          <span className="file-busy" aria-label="Deleting">
            <Icon name="spinner" size={16} strokeWidth={2} className="spin" />
          </span>
        ) : (
          menu
        )}
      </div>

      {/* Drive's card is mostly preview; ours carries the file's kind */}
      <div
        className="file-card-preview"
        style={{ "--tone": kind.tone } as CSSProperties}
      >
        <Icon name={kind.icon} size={34} strokeWidth={1.2} />

        <span className="file-card-ext mono">{kind.label}</span>

        {processing && (
          <span className="file-card-scan" aria-hidden="true" />
        )}
      </div>

      {file.description && (
        <p className="file-card-desc">
          <Highlight text={file.description} query={query} />
        </p>
      )}

      {sharing}

      <footer className="file-card-foot">
        <div className="file-card-badges">{badges}</div>

        <span className="file-card-meta num">
          {formatBytes(file.size)} · {formatRelative(file.createdAt)}
        </span>
      </footer>
    </article>
  );
};

export default FileCard;
