import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { describeFile } from "../../lib/fileKind";
import { formatBytes, formatRelative } from "../../lib/format";
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
  onOpen: (file: CloudFile) => void;
  onDownload: (file: CloudFile) => void;
  onEdit: (file: CloudFile) => void;
  onDelete: (file: CloudFile) => void;
}

const FileCard = ({
  file,
  view,
  isOwner,
  query = "",
  downloading = false,
  onOpen,
  onDownload,
  onEdit,
  onDelete,
}: FileCardProps) => {
  const kind = describeFile(file.mimeType, file.fileName);

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

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
        onClick={(event) => {
          event.stopPropagation();
          setMenuOpen((open) => !open);
          setConfirming(false);
        }}
      >
        <Icon name="more" size={17} strokeWidth={2.4} />
      </button>

      {menuOpen && (
        <div
          className="menu file-menu"
          role="menu"
          onClick={(event) => event.stopPropagation()}
        >
          {confirming ? (
            <div className="file-menu-confirm">
              <strong>Delete this file?</strong>

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
                    <Icon name="edit" size={16} />
                    Edit details
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

  const badges = (
    <>
      {file.publicAccess && (
        <span className="badge badge--accent">
          <Icon name="globe" size={12} strokeWidth={1.8} />
          Public
        </span>
      )}

      {!isOwner && (
        <span className="badge">
          <Icon name="users" size={12} strokeWidth={1.8} />
          Shared
        </span>
      )}

      {file.status !== "COMPLETED" && (
        <span className="badge badge--warn">
          <Icon name="clock" size={12} strokeWidth={1.8} />
          {file.status.toLowerCase()}
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

  if (view === "list") {
    return (
      <div className="file-row" {...openOnActivate}>
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

          <span className="file-row-name">
            <Highlight text={file.fileName} query={query} />
          </span>
        </div>

        <div className="file-row-badges">{badges}</div>

        <span className="file-row-size num">{formatBytes(file.size)}</span>

        <span className="file-row-date">{formatRelative(file.createdAt)}</span>

        <div className="file-row-actions">
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label={`Download ${file.title}`}
            disabled={downloading}
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

          {menu}
        </div>
      </div>
    );
  }

  return (
    <article className="file-card" {...openOnActivate}>
      <div className="file-card-top">
        <span
          className="file-glyph"
          style={{ "--tone": kind.tone } as CSSProperties}
        >
          <Icon name={kind.icon} size={20} />
        </span>

        {menu}
      </div>

      <h3 className="file-card-title">
        <Highlight text={file.title} query={query} />
      </h3>

      <p className="file-card-desc">
        {file.description ? (
          <Highlight text={file.description} query={query} />
        ) : (
          <span className="file-card-desc--empty">No description</span>
        )}
      </p>

      <div className="file-card-badges">{badges}</div>

      <footer className="file-card-foot">
        <span className="file-card-ext mono">{kind.label}</span>

        <span className="dot" />

        <span className="num">{formatBytes(file.size)}</span>

        <span className="dot" />

        <span>{formatRelative(file.createdAt)}</span>
      </footer>
    </article>
  );
};

export default FileCard;
