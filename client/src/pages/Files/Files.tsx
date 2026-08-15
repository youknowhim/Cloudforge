import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";

import FileCard from "../../components/FileCard/FileCard";
import FileModal from "../../components/FileModal/FileModal";
import Icon from "../../components/Icon/Icon";
import Loader from "../../components/Loader/Loader";
import { useToast } from "../../components/Toast/useToast";

import { extensionOf } from "../../lib/fileKind";
import { formatBytes } from "../../lib/format";
import { useDebounced } from "../../lib/useDebounced";

import { deleteFile, getFileDetail, getFiles } from "../../services/api";
import type { CloudFile } from "../../types/file";

import "./Files.css";

type Scope = "mine" | "shared";
type SortKey = "recent" | "oldest" | "name" | "size";
type View = "grid" | "list";

const SORTS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "size", label: "Largest first" },
];

const VIEW_KEY = "cloudforge.files.view";

const matches = (file: CloudFile, query: string): boolean => {
  if (!query) return true;

  return [
    file.title,
    file.description,
    file.fileName,
    extensionOf(file.fileName),
    file.mimeType,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
};

const sortFiles = (files: CloudFile[], sort: SortKey): CloudFile[] => {
  const time = (file: CloudFile) =>
    file.createdAt ? new Date(file.createdAt).getTime() : 0;

  return [...files].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return time(a) - time(b);
      case "name":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      case "size":
        return b.size - a.size;
      default:
        return time(b) - time(a);
    }
  });
};

const Files = () => {
  const { user } = useAuth();
  const { notify } = useToast();
  const location = useLocation();

  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [rawQuery, setRawQuery] = useState("");
  const query = useDebounced(rawQuery).trim().toLowerCase();

  const [scope, setScope] = useState<Scope>("mine");
  const [sort, setSort] = useState<SortKey>("recent");

  const [view, setView] = useState<View>(
    () => (localStorage.getItem(VIEW_KEY) as View) || "grid"
  );

  const [active, setActive] = useState<{
    file: CloudFile;
    editing: boolean;
  } | null>(null);

  const [downloadingId, setDownloadingId] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);

  /* Upload redirects here; the catalogue row only appears once the
     processing lambda has written it, so poll briefly. */
  const justUploaded = Boolean(
    (location.state as { uploaded?: boolean } | null)?.uploaded
  );

  const load = useCallback(async (background = false) => {
    try {
      if (background) setRefreshing(true);
      else setLoading(true);

      setError("");

      setFiles(await getFiles());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn't load your files."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* first fetch — state only changes once the request settles */
  useEffect(() => {
    let active = true;

    getFiles()
      .then((result) => active && setFiles(result))
      .catch(
        (cause: unknown) =>
          active &&
          setError(
            cause instanceof Error
              ? cause.message
              : "Couldn't load your files."
          )
      )
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!justUploaded) return;

    const timers = [4000, 9000, 15000].map((delay) =>
      window.setTimeout(() => load(true), delay)
    );

    return () => timers.forEach(window.clearTimeout);
  }, [justUploaded, load]);

  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);

  /* "/" jumps to search, the way every file browser worth using does */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const isOwner = useCallback(
    (file: CloudFile) => !file.userId || file.userId === user?.id,
    [user?.id]
  );

  const { mine, shared } = useMemo(() => {
    const mineFiles: CloudFile[] = [];
    const sharedFiles: CloudFile[] = [];

    for (const file of files) {
      (isOwner(file) ? mineFiles : sharedFiles).push(file);
    }

    return { mine: mineFiles, shared: sharedFiles };
  }, [files, isOwner]);

  /* Search runs over both buckets at once so the counts on the
     inactive tab stay honest. */
  const results = useMemo(
    () => ({
      mine: sortFiles(mine.filter((file) => matches(file, query)), sort),
      shared: sortFiles(shared.filter((file) => matches(file, query)), sort),
    }),
    [mine, shared, query, sort]
  );

  const visible = results[scope];
  const otherScope: Scope = scope === "mine" ? "shared" : "mine";
  const otherCount = results[otherScope].length;

  const stats = useMemo(
    () => ({
      count: mine.length,
      bytes: mine.reduce((total, file) => total + file.size, 0),
      publicCount: mine.filter((file) => file.publicAccess).length,
    }),
    [mine]
  );

  const handleDownload = async (file: CloudFile) => {
    try {
      setDownloadingId(file.id);

      const { downloadUrl } = await getFileDetail(file.id);

      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = file.fileName;
      link.rel = "noreferrer";

      /* Safari only honours a click on an anchor that's in the document */
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      notify(
        cause instanceof Error ? cause.message : "Download failed.",
        "error"
      );
    } finally {
      setDownloadingId("");
    }
  };

  const handleDelete = async (file: CloudFile) => {
    /* optimistic: the row goes now, and comes back if the API says no */
    setFiles((current) => current.filter((item) => item.id !== file.id));

    try {
      await deleteFile(file.id);

      notify(`"${file.title}" was deleted.`, "success");
    } catch (cause) {
      setFiles((current) => [file, ...current]);

      notify(
        cause instanceof Error ? cause.message : "Couldn't delete that file.",
        "error"
      );
    }
  };

  const handleUpdated = (updated: CloudFile) => {
    setFiles((current) =>
      current.map((file) => (file.id === updated.id ? updated : file))
    );

    setActive((current) =>
      current ? { file: updated, editing: false } : current
    );
  };

  const handleDeleted = (fileId: string) => {
    setFiles((current) => current.filter((file) => file.id !== fileId));
    setActive(null);
  };

  const tabs: { value: Scope; label: string; icon: "folder" | "users" }[] = [
    { value: "mine", label: "My files", icon: "folder" },
    { value: "shared", label: "Shared with me", icon: "users" },
  ];

  return (
    <main className="page files-page">
      <div className="shell">
        <header className="page-head">
          <div>
            <p className="eyebrow">Library</p>

            <h1>Files</h1>

            <p>
              Everything you've added, plus what other people have shared with
              you. One search looks through both.
            </p>
          </div>

          <div className="page-head-actions">
            <button
              type="button"
              className="btn"
              disabled={refreshing || loading}
              onClick={() => load(true)}
            >
              <Icon
                name="refresh"
                size={16}
                className={refreshing ? "spin" : undefined}
              />
              Refresh
            </button>

            <Link to="/upload" className="btn btn--primary">
              <Icon name="upload" size={16} />
              Upload
            </Link>
          </div>
        </header>

        <section className="stat-row" aria-label="Storage summary">
          <div className="stat">
            <span className="stat-label">Your files</span>
            <strong className="num">{stats.count}</strong>
          </div>

          <div className="stat">
            <span className="stat-label">Storage used</span>
            <strong className="num">{formatBytes(stats.bytes)}</strong>
          </div>

          <div className="stat">
            <span className="stat-label">Shared by you</span>
            <strong className="num">{stats.publicCount}</strong>
          </div>

          <div className="stat">
            <span className="stat-label">Shared with you</span>
            <strong className="num">{shared.length}</strong>
          </div>
        </section>

        {justUploaded && (
          <div className="alert files-notice">
            <Icon name="clock" size={16} />
            <span>
              Your file is still being tidied away. It'll appear here in a
              moment — we're checking for you.
            </span>
          </div>
        )}

        <div className="files-toolbar">
          <div className="segmented" role="tablist" aria-label="File scope">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={scope === tab.value}
                className={`segment${scope === tab.value ? " segment--on" : ""}`}
                onClick={() => setScope(tab.value)}
              >
                <Icon name={tab.icon} size={15} />

                {tab.label}

                <span className="segment-count num">
                  {results[tab.value].length}
                </span>
              </button>
            ))}
          </div>

          <div className="input-affix files-search">
            <span className="input-affix-icon">
              <Icon name="search" size={16} />
            </span>

            <input
              ref={searchRef}
              type="search"
              className="input input--with-icon"
              placeholder="Search titles, descriptions, file names…"
              value={rawQuery}
              aria-label="Search files"
              onChange={(event) => setRawQuery(event.target.value)}
            />

            {!rawQuery && <kbd className="search-kbd">/</kbd>}
          </div>

          <div className="files-controls">
            <div className="select-wrap">
              <select
                className="select"
                value={sort}
                aria-label="Sort files"
                onChange={(event) => setSort(event.target.value as SortKey)}
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Icon name="chevronDown" size={15} />
            </div>

            <div className="view-toggle" role="group" aria-label="Layout">
              {(["grid", "list"] as View[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`view-button${view === option ? " view-button--on" : ""}`}
                  aria-label={`${option} view`}
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                >
                  <Icon name={option} size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="files-grid" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="file-skeleton">
                <div className="skeleton" style={{ width: 40, height: 40 }} />
                <div className="skeleton" style={{ width: "62%", height: 13 }} />
                <div className="skeleton" style={{ width: "88%", height: 11 }} />
                <div className="skeleton" style={{ width: "40%", height: 11 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="state">
            <span className="state-icon">
              <Icon name="alert" size={20} />
            </span>

            <h2>We couldn't load your files</h2>

            <p>{error}</p>

            <button type="button" className="btn" onClick={() => load()}>
              <Icon name="refresh" size={16} />
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="state">
            <span className="state-icon">
              <Icon name={query ? "search" : "folder"} size={20} />
            </span>

            <h2>
              {query
                ? "No matches here"
                : scope === "mine"
                  ? "No files yet"
                  : "Nothing shared with you yet"}
            </h2>

            <p>
              {query
                ? `Nothing in ${scope === "mine" ? "your files" : "the shared library"} matches "${rawQuery.trim()}".`
                : scope === "mine"
                  ? "Add your first file and it will show up right here."
                  : "When someone shares a file, you'll find it in this tab."}
            </p>

            {query && otherCount > 0 ? (
              <button
                type="button"
                className="btn"
                onClick={() => setScope(otherScope)}
              >
                <Icon name="arrowRight" size={16} />
                {otherCount} match{otherCount === 1 ? "" : "es"} in{" "}
                {otherScope === "mine" ? "My files" : "Shared with me"}
              </button>
            ) : (
              !query &&
              scope === "mine" && (
                <Link to="/upload" className="btn btn--primary">
                  <Icon name="upload" size={16} />
                  Upload a file
                </Link>
              )
            )}
          </div>
        ) : (
          <>
            {query && otherCount > 0 && (
              <button
                type="button"
                className="cross-scope"
                onClick={() => setScope(otherScope)}
              >
                <Icon name="search" size={15} />

                <span>
                  {otherCount} more match{otherCount === 1 ? "" : "es"} in{" "}
                  <strong>
                    {otherScope === "mine" ? "My files" : "Shared with me"}
                  </strong>
                </span>

                <Icon name="chevronRight" size={15} />
              </button>
            )}

            <div className={view === "grid" ? "files-grid" : "files-list card"}>
              {visible.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  view={view}
                  query={query}
                  isOwner={isOwner(file)}
                  downloading={downloadingId === file.id}
                  onOpen={(target) => setActive({ file: target, editing: false })}
                  onEdit={(target) => setActive({ file: target, editing: true })}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            <p className="files-count">
              Showing {visible.length} of{" "}
              {scope === "mine" ? mine.length : shared.length}{" "}
              {scope === "mine" ? "files you added" : "files shared with you"}
              {refreshing && (
                <>
                  {" · "}
                  <Loader text="Refreshing" size={13} />
                </>
              )}
            </p>
          </>
        )}
      </div>

      {active && (
        <FileModal
          file={active.file}
          isOwner={isOwner(active.file)}
          startInEdit={active.editing}
          onClose={() => setActive(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </main>
  );
};

export default Files;
