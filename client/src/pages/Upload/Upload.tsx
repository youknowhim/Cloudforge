import {
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router-dom";

import Icon from "../../components/Icon/Icon";
import Loader from "../../components/Loader/Loader";
import { useToast } from "../../components/Toast/useToast";

import { describeFile } from "../../lib/fileKind";
import { baseName, formatBytes } from "../../lib/format";

import { createFile, uploadToS3 } from "../../services/api";

import "./Upload.css";

type Stage = "idle" | "signing" | "transferring" | "done";

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

  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publicAccess, setPublicAccess] = useState(false);

  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const busy = stage === "signing" || stage === "transferring";

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;

    setFile(selected);
    setError("");
    setProgress(0);
    setStage("idle");

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
    setPublicAccess(false);
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

    try {
      setStage("signing");

      const { uploadUrl } = await createFile({
        fileName: file.name,
        title: title.trim(),
        description: description.trim(),
        /* browsers leave `type` empty for unknown extensions */
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        publicAccess,
      });

      if (!uploadUrl) {
        throw new Error(
          "We couldn't get things ready for this file. Please try again."
        );
      }

      setStage("transferring");

      await uploadToS3(uploadUrl, file, setProgress);

      setStage("done");
      notify("Upload complete.", "success");

      navigate("/files", { state: { uploaded: true } });
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
            <p className="eyebrow">New upload</p>

            <h1>Add a file</h1>

            <p>
              Pick a file, give it a name you'll recognise later, and choose
              whether anyone else can see it.
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
              <input
                ref={inputRef}
                type="file"
                hidden
                disabled={busy}
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
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <span className="dropzone-icon">
                    <Icon name="upload" size={20} />
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

            <label className="switch upload-visibility">
              <input
                type="checkbox"
                checked={publicAccess}
                disabled={busy}
                onChange={(event) => setPublicAccess(event.target.checked)}
              />

              <span className="switch-track" />

              <span>
                <strong>
                  {publicAccess ? "Anyone can see this" : "Only you can see this"}
                </strong>

                <span className="hint">
                  {publicAccess
                    ? "Everyone else will find it under Shared with me."
                    : "You can share it later — nothing is set in stone."}
                </span>
              </span>
            </label>

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
                className="btn"
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
                Your file turns up in your library a few seconds after it
                finishes sending. You don't have to wait on this page.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default Upload;
