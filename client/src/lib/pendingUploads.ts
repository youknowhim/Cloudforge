import type { CloudFile } from "../types/file";

/*
  A file lands in S3 seconds before the processing lambda writes its
  row, so a fresh upload would otherwise vanish until the next poll.

  We keep a short-lived placeholder in sessionStorage — it survives the
  navigate from /upload to /files, shows up as a "Processing" card
  straight away, and is dropped as soon as the real row appears (or
  once it goes stale, so a failed upload can't haunt the grid).
*/

const KEY = "cloudforge.pending-uploads";

/* long enough for the lambda, short enough that a failure clears itself */
const TTL = 4 * 60_000;

interface StoredUpload {
  file: CloudFile;
  /* file_name the lambda will write, used to match the real row */
  matchName: string;
  addedAt: number;
}

/* mirrors the server's key sanitiser so the match name lines up */
export const safeFileName = (fileName: string): string =>
  String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

const readRaw = (): StoredUpload[] => {
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(KEY) ?? "[]"
    );

    if (!Array.isArray(parsed)) return [];

    const now = Date.now();

    return (parsed as StoredUpload[]).filter(
      (entry) => entry?.file?.id && now - entry.addedAt < TTL
    );
  } catch {
    return [];
  }
};

const writeRaw = (entries: StoredUpload[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* private mode / quota — the placeholder is a nicety, not a need */
  }
};

export const addPendingUpload = (
  file: CloudFile,
  matchName: string
): void => {
  writeRaw([
    { file: { ...file, pending: true, status: "processing" }, matchName, addedAt: Date.now() },
    ...readRaw().filter((entry) => entry.file.id !== file.id),
  ]);
};

export const removePendingUpload = (fileId: string): void => {
  writeRaw(readRaw().filter((entry) => entry.file.id !== fileId));
};

/*
  Drops placeholders whose real row has arrived, then returns the ones
  still waiting. Call it with every fresh server list.
*/
export const reconcilePendingUploads = (
  serverFiles: CloudFile[]
): CloudFile[] => {
  const landed = new Set(serverFiles.map((file) => file.fileName));

  const waiting = readRaw().filter((entry) => !landed.has(entry.matchName));

  writeRaw(waiting);

  return waiting.map((entry) => ({
    ...entry.file,
    pending: true,
    status: "processing" as const,
  }));
};
