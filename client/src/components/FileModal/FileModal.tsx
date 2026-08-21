import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { ApiError, deleteFile, getFileDetail, updateFile } from "../../services/api";
import { describeFile, isPreviewable } from "../../lib/fileKind";
import { formatBytes, formatDateTime, initialsOf } from "../../lib/format";
import type { CloudFile } from "../../types/file";

import Icon from "../Icon/Icon";
import Loader from "../Loader/Loader";
import ShareEmails from "../ShareEmails/ShareEmails";
import { useToast } from "../Toast/useToast";

import "./FileModal.css";

interface FileModalProps {
  file: CloudFile;
  isOwner: boolean;
  startInEdit?: boolean;
  ownEmail?: string;
  onClose: () => void;
  onUpdated: (file: CloudFile) => void;
  onDeleted: (fileId: string) => void;
}

const FileModal = ({
  file,
  isOwner,
  startInEdit = false,
  ownEmail,
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

  const [sharing, setSharing] = useState((file.sharedWith ?? []).length > 0);
  const [emails, setEmails] = useState<string[]>(file.sharedWith ?? []);
  const [shareError, setShareError] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [downloadUrl, setDownloadUrl] = useState("");
  const [linkError, setLinkError] = useState("");

  /*
    The row exists before the object is usable, so the detail call can
    legitimately answer 409. That isn't an error to apologise for — it
    just means "check back in a moment".
  */
  const [processing, setProcessing] = useState(
    file.status === "processing" || Boolean(file.pending)
  );

  /* one signed URL per open — powers both preview and download */
  useEffect(() => {
    if (file.pending) return;

    let active = true;

    getFileDetail(file.id)
      .then((detail) => {
        if (!active) return;

        setDownloadUrl(detail.downloadUrl);
        setProcessing(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;

        if (cause instanceof ApiError && cause.status === 409) {
          setProcessing(true);
          return;
        }

        setLinkError(
          cause instanceof Error
            ? cause.message
            : "We can't open this file right now."
        );
      });

    return () => {
      active = false;
    };
  }, [file.id, file.pending]);

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

  const resetForm = () => {
    setTitle(file.title);
    setDescription(file.description);
    setEmails(file.sharedWith ?? []);
    setSharing((file.sharedWith ?? []).length > 0);
    setShareError("");
    setError("");
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!title.trim()) {
      setError("Give the file a title.");
      return;
    }

    /* sharing with nobody isn't sharing — say so rather than saving it */
    if (sharing && emails.length === 0) {
      setShareError("Add at least one person, or turn sharing off.");
      return;
    }

    const nextEmails = sharing ? emails : [];

    try {
      setSaving(true);
      setError("");
      setShareError("");

      const updated = await updateFile(file.id, {
        title: title.trim(),
        description: description.trim(),
        share_to_emails: nextEmails,
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
        sharedWith: nextEmails,
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

      /* the modal stays open, spinner and all, until the API confirms */
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

  const sharedWith = file.sharedWith ?? [];

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
  ];

  const processingNotice = (
    <div className="modal-processing">
      <span className="modal-processing-icon">
        <Icon name="spinner" size={22} strokeWidth={2} className="spin" />
      </span>

      <div>
        <strong>This file is still being processed</strong>

        <p>
          We're scanning it and filing it away. Give it a few seconds — it'll
          be ready to preview and download shortly.
        </p>
      </div>
    </div>
  );

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
            <Icon name="x" size={20} />
          </button>
        </header>

        <div className="modal-body">
          {processing && processingNotice}

          {!processing && isPreviewable(file.mimeType) && (
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

              <div className="share-panel">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={sharing}
                    disabled={saving}
                    onChange={(event) => {
                      setSharing(event.target.checked);
                      setShareError("");
                    }}
                  />

                  <span className="switch-track" />

                  <span>
                    <strong>Share with specific people</strong>

                    <span className="hint">
                      {sharing
                        ? "They'll find it under Shared with me."
                        : "Only you can see this file."}
                    </span>
                  </span>
                </label>

                {sharing && (
                  <ShareEmails
                    emails={emails}
                    onChange={(next) => {
                      setEmails(next);
                      setShareError("");
                    }}
                    disabled={saving}
                    ownEmail={ownEmail}
                    error={shareError}
                  />
                )}
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false);
                    resetForm();
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

              {/* who can see it — the same split the card shows */}
              <section className="modal-people">
                <h3>{isOwner ? "People with access" : "Shared with you by"}</h3>

                {isOwner ? (
                  sharedWith.length > 0 ? (
                    <ul className="people-list">
                      {sharedWith.map((email) => (
                        <li key={email}>
                          <span className="people-avatar">
                            {initialsOf(
                              email.split("@")[0],
                              email.slice(0, 2).toUpperCase()
                            )}
                          </span>

                          <span className="people-email">{email}</span>

                          <span className="badge">Viewer</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="people-empty">
                      <Icon name="lock" size={15} />
                      Private — nobody else can open this file.
                    </p>
                  )
                ) : (
                  <ul className="people-list">
                    <li>
                      <span className="people-avatar people-avatar--owner">
                        {initialsOf(
                          file.sharedBy?.name ?? file.sharedBy?.email
                        )}
                      </span>

                      <span className="people-email">
                        {file.sharedBy?.name || file.sharedBy?.email}

                        {file.sharedBy?.name && file.sharedBy?.email && (
                          <small>{file.sharedBy.email}</small>
                        )}
                      </span>

                      <span className="badge">Owner</span>
                    </li>
                  </ul>
                )}
              </section>

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
                  className="btn btn--ghost"
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
                    disabled={processing}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Icon name="trash" size={16} />
                    Delete
                  </button>
                )}

                <div className="modal-footer-right">
                  <button
                    type="button"
                    className="btn btn--ghost"
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
                      disabled={processing}
                      onClick={() => setEditing(true)}
                    >
                      <Icon name="users" size={16} />
                      Share
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
