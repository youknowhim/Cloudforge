import {
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";

import Icon from "../../components/Icon/Icon";
import Loader from "../../components/Loader/Loader";
import ShareEmails from "../../components/ShareEmails/ShareEmails";
import { useToast } from "../../components/Toast/useToast";

import { describeFile } from "../../lib/fileKind";
import { baseName, formatBytes } from "../../lib/format";
import { addPendingUpload, safeFileName } from "../../lib/pendingUploads";

import { createFile, uploadToS3 } from "../../services/api";

import "./Upload.css";

type Stage = "idle" | "signing" | "transferring" | "done";

/*
  Must track MAX_FILE_SIZE in the processing lambda. Checking here means
  an oversized file is refused in the form instead of being uploaded,
  deleted server-side, and reported back as a failure minutes later.
*/
const MAX_UPLOAD_SIZE = Number(
  import.meta.env.VITE_MAX_FILE_SIZE ?? 10 * 1024 * 1024
);

const STEPS: { stage: Stage; label: string; detail: string }[] = [
  {
    stage: "signing",
    label: "Getting ready",
    detail: "Setting aside a private spot for your file",
  },
  {
    stage: "transferring",
    label: "Sending",
    detail: "Your file is on its way — you'll see the progress",
  },
  {
    stage: "done",
    label: "Filing it away",
    detail: "Adding it to your library so you can find it",
  },
];

const Upload = () => {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { user } = useAuth();

  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [sharing, setSharing] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [shareError, setShareError] = useState("");

  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const busy = stage === "signing" || stage === "transferring";

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;

    setFile(selected);
    setProgress(0);
    setStage("idle");

    /* say it now, at the moment they pick the file */
    setError(
      selected.size > MAX_UPLOAD_SIZE
        ? `That file is ${formatBytes(selected.size)}. The limit is ${formatBytes(
            MAX_UPLOAD_SIZE
          )} — pick a smaller one.`
        : ""
    );

    if (!title.trim()) setTitle(baseName(selected.name));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);

    if (busy) return;

    selectFile(event.dataTransfer.files?.[0]);
  };

  const reset = () => {
    setFile(null);
    setTitle("");
    setDescription("");
    setSharing(false);
    setEmails([]);
    setShareError("");
    setProgress(0);
    setStage("idle");
    setError("");

    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setError("");

    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    if (!title.trim()) {
      setError("Give the file a title so you can find it later.");
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      setError(
        `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(
          MAX_UPLOAD_SIZE
        )} — pick a smaller one.`
      );
      return;
    }

    /*
      Sharing with an empty list is a contradiction, so the toggle goes
      back off. The explanation is a toast rather than inline text —
      inline, it outlived the state it described and sat there nagging
      about a toggle that was already off.
    */
    if (sharing && emails.length === 0) {
      setSharing(false);
      setShareError("");

      notify(
        "An email address is required to share, so sharing was turned back off.",
        "error"
      );

      return;
    }

    const share_to_emails = sharing ? emails : [];

    try {
      setStage("signing");

      const { fileId, uploadUrl } = await createFile({
        fileName: file.name,
        title: title.trim(),
        description: description.trim(),
        /* browsers leave `type` empty for unknown extensions */
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        share_to_emails,
      });

      if (!uploadUrl) {
        throw new Error(
          "We couldn't get things ready for this file. Please try again."
        );
      }

      setStage("transferring");

      await uploadToS3(uploadUrl, file, setProgress);

      setStage("done");

      /*
        Show the card immediately. The processing lambda writes the real
        row a few seconds later, and the library swaps this placeholder
        out the moment it appears.
      */
      addPendingUpload(
        {
          id: fileId,
          userId: user?.id ?? "",
          fileName: file.name,
          title: title.trim(),
          description: description.trim(),
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          sharedWith: share_to_emails,
          status: "processing",
          createdAt: new Date().toISOString(),
        },
        `${fileId}-${safeFileName(file.name)}`
      );

      notify("Upload complete — we're processing it now.", "success");

      navigate("/files");
    } catch (cause) {
      setStage("idle");
      setProgress(0);

      setError(cause instanceof Error ? cause.message : "Upload failed.");
    }
  };

  const kind = file ? describeFile(file.type, file.name) : null;

  const stageIndex = STEPS.findIndex((step) => step.stage === stage);

  return (
    <main className="page upload-page">
      <div className="shell upload-shell">
        <header className="page-head">
          <div>
            <h1>Add a file</h1>

            <p>
              Pick a file, give it a name you'll recognise later, and choose who
              else can see it.
            </p>
          </div>
        </header>

        <div className="upload-columns">
          <form className="upload-form card" onSubmit={handleSubmit}>
            <div
              className={`dropzone${dragging ? " dropzone--over" : ""}${
                file ? " dropzone--filled" : ""
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!busy) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => !busy && inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                inputRef.current?.click();
              }}
            >
              {/*
                The input lives inside the dropzone, so the click we
                fire on it bubbles straight back into the dropzone's
                own handler and re-opens the picker. Stop it here.
              */}
              <input
                ref={inputRef}
                type="file"
                hidden
                disabled={busy}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => selectFile(event.target.files?.[0])}
              />

              {file && kind ? (
                <div className="dropzone-file">
                  <span
                    className="file-glyph"
                    style={{ "--tone": kind.tone } as CSSProperties}
                  >
                    <Icon name={kind.icon} size={20} />
                  </span>

                  <div className="dropzone-file-info">
                    <strong>{file.name}</strong>

                    <span>
                      {kind.label} · {formatBytes(file.size)}
                    </span>
                  </div>

                  {!busy && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      aria-label="Remove selected file"
                      onClick={(event) => {
                        event.stopPropagation();
                        reset();
                      }}
                    >
                      <Icon name="x" size={18} />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <span className="dropzone-icon">
                    <Icon name="upload" size={24} strokeWidth={1.5} />
                  </span>

                  <strong>Drop a file here, or click to browse</strong>

                  <span className="hint">
                    Any kind of file. Big ones are fine too.
                  </span>
                </>
              )}
            </div>

            <div className="field">
              <label htmlFor="upload-title">Title</label>

              <input
                id="upload-title"
                className="input"
                value={title}
                disabled={busy}
                placeholder="Q3 performance report"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="upload-description">
                Description <span className="label-optional">optional</span>
              </label>

              <textarea
                id="upload-description"
                className="textarea"
                rows={3}
                value={description}
                disabled={busy}
                placeholder="A sentence of context helps future-you search for this."
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {/* --------- sharing --------- */}

            <div className="share-panel">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={sharing}
                  disabled={busy}
                  onChange={(event) => {
                    setSharing(event.target.checked);
                    setShareError("");
                  }}
                />

                <span className="switch-track" />

                <span>
                  <strong>
                    {sharing
                      ? "Share with specific people"
                      : "Only you can see this"}
                  </strong>

                  <span className="hint">
                    {sharing
                      ? "Add the people who should get it — they'll find it under Shared with me."
                      : "You can share it later — nothing is set in stone."}
                  </span>
                </span>
              </label>

              {sharing && (
                <div className="share-panel-body">
                  <span className="label">Add people</span>

                  <ShareEmails
                    emails={emails}
                    onChange={(next) => {
                      setEmails(next);
                      setShareError("");
                    }}
                    disabled={busy}
                    ownEmail={user?.email}
                    error={shareError}
                    autoFocus
                  />
                </div>
              )}

            </div>

            {error && (
              <div className="alert alert--error" role="alert">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}

            {busy && (
              <div className="upload-progress">
                <div className="upload-progress-head">
                  <span>
                    {stage === "signing"
                      ? "Getting ready…"
                      : "Sending your file…"}
                  </span>

                  <span className="num">{progress}%</span>
                </div>

                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`progress-fill${
                      stage === "signing" ? " progress-fill--indeterminate" : ""
                    }`}
                    style={{ width: `${Math.max(progress, 4)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="upload-actions">
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy || (!file && !title && !description)}
                onClick={reset}
              >
                Clear
              </button>

              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy || !file}
              >
                {busy ? (
                  <Loader text="Uploading" size={16} />
                ) : (
                  <>
                    <Icon name="upload" size={16} />
                    Upload file
                  </>
                )}
              </button>
            </div>
          </form>

          <aside className="upload-aside">
            <div className="card upload-steps">
              <h2>What happens next</h2>

              <ol>
                {STEPS.map((step, index) => {
                  const state =
                    stage === "idle"
                      ? "pending"
                      : index < stageIndex
                        ? "done"
                        : index === stageIndex
                          ? "active"
                          : "pending";

                  return (
                    <li key={step.stage} data-state={state}>
                      <span className="step-marker">
                        {state === "done" ? (
                          <Icon name="check" size={13} strokeWidth={2.4} />
                        ) : (
                          index + 1
                        )}
                      </span>

                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.detail}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="card upload-tip">
              <span className="upload-tip-icon">
                <Icon name="info" size={16} />
              </span>

              <p>
                Your file shows up in the library straight away with a
                <strong> Processing </strong>
                marker, and becomes downloadable a few seconds later.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default Upload;
