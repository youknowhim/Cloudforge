import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { deleteFile, getFileDetail, updateFile } from "../../services/api";
import { describeFile, isPreviewable } from "../../lib/fileKind";
import { formatBytes, formatDateTime } from "../../lib/format";
import type { CloudFile } from "../../types/file";

import Icon from "../Icon/Icon";
import Loader from "../Loader/Loader";
import { useToast } from "../Toast/useToast";

import "./FileModal.css";

interface FileModalProps {
  file: CloudFile;
  isOwner: boolean;
  startInEdit?: boolean;
  onClose: () => void;
  onUpdated: (file: CloudFile) => void;
  onDeleted: (fileId: string) => void;
}

const FileModal = ({
  file,
  isOwner,
  startInEdit = false,
  onClose,
  onUpdated,
  onDeleted,
}: FileModalProps) => {
  const { notify } = useToast();

  const kind = describeFile(file.mimeType, file.fileName);

  const [editing, setEditing] = useState(startInEdit);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [title, setTitle] = useState(file.title);
  const [description, setDescription] = useState(file.description);
  const [publicAccess, setPublicAccess] = useState(file.publicAccess);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [downloadUrl, setDownloadUrl] = useState("");
  const [linkError, setLinkError] = useState("");

  /* one signed URL per open — powers both preview and download */
  useEffect(() => {
    let active = true;

    getFileDetail(file.id)
      .then((detail) => {
        if (active) setDownloadUrl(detail.downloadUrl);
      })
      .catch((cause: unknown) => {
        if (!active) return;

        setLinkError(
          cause instanceof Error
            ? cause.message
            : "We can't open this file right now."
        );
      });

    return () => {
      active = false;
    };
  }, [file.id]);

  /* escape to close, and keep the page behind from scrolling */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      setError("Give the file a title.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updated = await updateFile(file.id, {
        title: title.trim(),
        description: description.trim(),
        publicAccess,
      });

      /*
        PATCH doesn't echo every column, so merge over what we already
        know rather than trusting the response wholesale.
      */
      onUpdated({
        ...file,
        ...updated,
        id: file.id,
        userId: file.userId,
        title: title.trim(),
        description: description.trim(),
        publicAccess,
      });

      setEditing(false);
      notify("File details updated.", "success");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't save your changes."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setError("");

      await deleteFile(file.id);

      onDeleted(file.id);
      notify(`"${file.title}" was deleted.`, "success");
    } catch (cause) {
      setDeleting(false);
      setConfirmingDelete(false);

      setError(
        cause instanceof Error ? cause.message : "Couldn't delete this file."
      );
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(downloadUrl);
      notify("Link copied. It works for the next 15 minutes.", "success");
    } catch {
      notify("Your browser wouldn't let us copy the link.", "error");
    }
  };

  const meta = [
    { label: "File name", value: file.fileName },
    {
      label: "Kind",
      value: kind.extension
        ? `${kind.extension.toUpperCase()} ${kind.kindLabel.toLowerCase()}`
        : kind.kindLabel,
    },
    { label: "Size", value: formatBytes(file.size) },
    { label: "Added", value: formatDateTime(file.createdAt) },
    { label: "Last changed", value: formatDateTime(file.updatedAt) },
    {
      label: "Who can see it",
      value: file.publicAccess ? "Everyone" : "Only you",
    },
  ];

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={file.title}
      >
        <header className="modal-header">
          <span
            className="file-glyph"
            style={{ "--tone": kind.tone } as CSSProperties}
          >
            <Icon name={kind.icon} size={20} />
          </span>

          <div className="modal-heading">
            <h2>{file.title}</h2>
            <p>{file.fileName}</p>
          </div>

          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="Close"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="modal-body">
          {isPreviewable(file.mimeType) && (
            <div className="modal-preview">
              {!downloadUrl && !linkError && (
                <Loader text="Loading preview" />
              )}

              {linkError && (
                <div className="modal-preview-empty">
                  <Icon name="eyeOff" size={18} />
                  <span>{linkError}</span>
                </div>
              )}

              {downloadUrl && file.mimeType.startsWith("image/") && (
                <img src={downloadUrl} alt={file.title} />
              )}

              {downloadUrl && file.mimeType.startsWith("video/") && (
                <video src={downloadUrl} controls />
              )}

              {downloadUrl && file.mimeType.startsWith("audio/") && (
                <audio src={downloadUrl} controls />
              )}

              {downloadUrl && file.mimeType === "application/pdf" && (
                <iframe src={downloadUrl} title={file.title} />
              )}
            </div>
          )}

          {error && (
            <div className="alert alert--error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}

          {editing ? (
            <form className="modal-form" onSubmit={handleSave}>
              <div className="field">
                <label htmlFor="modal-title">Title</label>

                <input
                  id="modal-title"
                  className="input"
                  value={title}
                  disabled={saving}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="modal-description">Description</label>

                <textarea
                  id="modal-description"
                  className="textarea"
                  rows={4}
                  value={description}
                  disabled={saving}
                  placeholder="What is this file for?"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <label className="switch modal-visibility">
                <input
                  type="checkbox"
                  checked={publicAccess}
                  disabled={saving}
                  onChange={(event) => setPublicAccess(event.target.checked)}
                />

                <span className="switch-track" />

                <span>
                  <strong>Let everyone see this</strong>
                  <span className="hint">
                    Other people will find it under Shared with me.
                  </span>
                </span>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    setTitle(file.title);
                    setDescription(file.description);
                    setPublicAccess(file.publicAccess);
                    setError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving}
                >
                  {saving ? <Loader text="Saving" size={16} /> : "Save changes"}
                </button>
              </div>
            </form>
          ) : (
            <>
              {file.description && (
                <p className="modal-description">{file.description}</p>
              )}

              <dl className="modal-meta">
                {meta.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>

        {!editing && (
          <footer className="modal-footer">
            {confirmingDelete ? (
              <>
                <span className="modal-confirm-text">
                  Delete "{file.title}" permanently?
                </span>

                <button
                  type="button"
                  className="btn"
                  disabled={deleting}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep it
                </button>

                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting ? <Loader text="Deleting" size={16} /> : "Delete"}
                </button>
              </>
            ) : (
              <>
                {isOwner && (
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Icon name="trash" size={16} />
                    Delete
                  </button>
                )}

                <div className="modal-footer-right">
                  <button
                    type="button"
                    className="btn"
                    disabled={!downloadUrl}
                    onClick={handleCopyLink}
                  >
                    <Icon name="link" size={16} />
                    Copy link
                  </button>

                  {isOwner && (
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setEditing(true)}
                    >
                      <Icon name="edit" size={16} />
                      Edit
                    </button>
                  )}

                  <a
                    className={`btn btn--primary${downloadUrl ? "" : " btn--disabled"}`}
                    href={downloadUrl || undefined}
                    download={file.fileName}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={!downloadUrl}
                  >
                    <Icon name="download" size={16} />
                    Download
                  </a>
                </div>
              </>
            )}
          </footer>
        )}
      </div>
    </div>
  );
};

export default FileModal;
