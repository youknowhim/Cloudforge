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

/*
  How long a placeholder is allowed to say "Processing". The lambda
  writes a row either way — clean or failed — so overrunning this means
  something went wrong upstream, and the card says so rather than
  spinning forever.
*/
const TTL = 90_000;

/* after this we stop showing the stale card at all */
const HARD_TTL = 30 * 60_000;

interface StoredUpload {
  /*
    Who uploaded it. sessionStorage is shared by every account that
    signs in to the same tab, so without this an upload made by one
    user shows up as a Processing card for whoever logs in next —
    their file list can never match it, so it just sits there.
  */
  ownerId: string;
  file: CloudFile;
  /* file_name the lambda will write, used to match the real row */
  matchName: string;
  addedAt: number;
}

/* mirrors the server's key sanitiser so the match name lines up */
export const safeFileName = (fileName: string): string =>
  String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

/* every entry in the tab, whoever it belongs to */
const readAll = (): StoredUpload[] => {
  try {
    const parsed: unknown = JSON.parse(
      sessionStorage.getItem(KEY) ?? "[]"
    );

    if (!Array.isArray(parsed)) return [];

    const now = Date.now();

    return (parsed as StoredUpload[]).filter(
      (entry) => entry?.file?.id && now - entry.addedAt < HARD_TTL
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
  userId: string,
  file: CloudFile,
  matchName: string
): void => {
  /* nothing to scope it to means nothing safe to show */
  if (!userId) return;

  writeRaw([
    {
      ownerId: userId,
      file: { ...file, pending: true, status: "processing" },
      matchName,
      addedAt: Date.now(),
    },
    ...readAll().filter(
      (entry) => !(entry.ownerId === userId && entry.file.id === file.id)
    ),
  ]);
};

export const removePendingUpload = (
  userId: string,
  fileId: string
): void => {
  writeRaw(
    readAll().filter(
      (entry) => !(entry.ownerId === userId && entry.file.id === fileId)
    )
  );
};

/* belt and braces: signing out empties the tab's placeholders */
export const clearPendingUploads = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing we can do, and nothing that matters */
  }
};

/*
  Drops placeholders whose real row has arrived, then returns the ones
  still waiting. Call it with every fresh server list.

  A placeholder that outlives TTL is reported as failed rather than
  left spinning: the row was never written, so waiting longer won't
  help and the card needs to be dismissable.
*/
export const reconcilePendingUploads = (
  userId: string,
  serverFiles: CloudFile[]
): CloudFile[] => {
  if (!userId) return [];

  const landed = new Set(serverFiles.map((file) => file.fileName));

  const all = readAll();

  const waiting = all.filter(
    (entry) => entry.ownerId === userId && !landed.has(entry.matchName)
  );

  /* another account's placeholders are left exactly as they were */
  writeRaw([
    ...all.filter((entry) => entry.ownerId !== userId),
    ...waiting,
  ]);

  const now = Date.now();

  return waiting.map((entry) => {
    const expired = now - entry.addedAt > TTL;

    return {
      ...entry.file,
      pending: true,
      status: expired ? ("failed" as const) : ("processing" as const),
    };
  });
};

/* true while at least one placeholder is still worth polling for */
export const hasWaitingUploads = (files: CloudFile[]): boolean =>
  files.some((file) => file.pending && file.status === "processing");
