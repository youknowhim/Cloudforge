import type {
  CloudFile,
  CreateFileResponse,
  EmailCheckResult,
  FileDetail,
  FileMetadata,
  FileOwner,
  FileStatus,
  FileUpdate,
} from "../types/file";

import type {
  AuthUser,
  Credentials,
  LoginResponse,
  SignupPayload,
  SignupResponse,
} from "../types/auth";

import {
  clearSession,
  isTokenExpired,
  notifySessionExpired,
  readToken,
} from "./session";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  "https://zfp69es977.execute-api.ap-southeast-2.amazonaws.com"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  /* set to false for the public auth endpoints */
  auth?: boolean;
}

const messageFrom = (data: unknown, fallback: string): string => {
  if (typeof data === "string" && data.trim()) return data;

  if (data && typeof data === "object" && "message" in data) {
    const message = (data as { message: unknown }).message;

    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
};

const request = async <T>(
  endpoint: string,
  { auth = true, headers, ...options }: RequestOptions = {}
): Promise<T> => {
  const requestHeaders = new Headers(headers);

  if (!(options.body instanceof FormData) && options.body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = readToken();

    if (!token || isTokenExpired(token)) {
      clearSession();
      notifySessionExpired();

      throw new ApiError("Your session has expired. Please sign in again.", 401);
    }

    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: requestHeaders,
    });
  } catch (cause) {
    /* a superseded request isn't a failure — let callers ignore it */
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }

    throw new ApiError(
      "We can't reach CloudForge right now. Check your connection and try again.",
      0
    );
  }

  const isJson = response.headers
    .get("content-type")
    ?.includes("application/json");

  const data: unknown = response.status === 204
    ? null
    : isJson
      ? await response.json().catch(() => null)
      : await response.text();

  if (!response.ok) {
    if (response.status === 401 && auth) {
      clearSession();
      notifySessionExpired();
    }

    throw new ApiError(
      messageFrom(data, "Something went wrong. Please try again."),
      response.status
    );
  }

  return data as T;
};

/* =========================================================
   Normalisation

   The API answers in snake_case from Postgres on some routes and
   camelCase on others, so every file goes through one shape.
   ========================================================= */

type RawFile = Record<string, unknown>;

const pick = <T>(raw: RawFile, ...keys: string[]): T | undefined => {
  for (const key of keys) {
    const value = raw[key];

    if (value !== undefined && value !== null) return value as T;
  }

  return undefined;
};

/*
  The API answers with `sharedWith` for files you own and `sharedBy`
  for files someone shared with you — never both. That distinction is
  what the card renders, so preserve it rather than flattening it.
*/
const normalizeShared = (raw: RawFile): string[] => {
  const value = pick<unknown>(raw, "sharedWith", "share_to_emails");

  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }

  /* jsonb can arrive as a string if a driver doesn't parse it */
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);

      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  return [];
};

const normalizeOwner = (raw: RawFile): FileOwner | undefined => {
  const value = pick<unknown>(raw, "sharedBy", "shared_by");

  if (!value || typeof value !== "object") return undefined;

  const owner = value as { name?: unknown; email?: unknown };

  return {
    name: owner.name ? String(owner.name) : undefined,
    email: owner.email ? String(owner.email) : undefined,
  };
};

const normalizeFile = (raw: RawFile): CloudFile => ({
  id: String(pick<string>(raw, "id", "fileId") ?? ""),
  userId: String(pick<string>(raw, "userId", "user_id") ?? ""),

  fileName: String(pick<string>(raw, "fileName", "file_name") ?? ""),
  title: String(pick<string>(raw, "title") ?? "Untitled"),
  description: String(pick<string>(raw, "description") ?? ""),

  mimeType: String(pick<string>(raw, "mimeType", "mime_type") ?? ""),
  size: Number(pick<number>(raw, "size") ?? 0),

  s3Key: pick<string>(raw, "s3Key", "s3_key"),

  sharedWith: normalizeShared(raw),
  sharedBy: normalizeOwner(raw),

  status: (pick<FileStatus>(raw, "status") ?? "clean") as FileStatus,

  createdAt: pick<string>(raw, "createdAt", "created_at"),
  updatedAt: pick<string>(raw, "updatedAt", "updated_at"),
});

const collectionFrom = (payload: unknown): RawFile[] => {
  if (Array.isArray(payload)) return payload as RawFile[];

  if (payload && typeof payload === "object") {
    const { files, data } = payload as {
      files?: RawFile[];
      data?: RawFile[];
    };

    return files ?? data ?? [];
  }

  return [];
};

/* =========================================================
   Auth
   ========================================================= */

export const login = (credentials: Credentials): Promise<LoginResponse> =>
  request<LoginResponse>("/auth/login", {
    auth: false,
    method: "POST",
    body: JSON.stringify({
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    }),
  });

export const signup = (payload: SignupPayload): Promise<SignupResponse> =>
  request<SignupResponse>("/auth/signup", {
    auth: false,
    method: "POST",
    body: JSON.stringify({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    }),
  });

export type { AuthUser };

/* =========================================================
   Users
   ========================================================= */

/*
  Existence check for the share box. A GET with the address in the
  query string, debounced by the caller so a fast typist doesn't fire
  one request per keystroke.
*/
export const checkUserEmail = async (
  email: string,
  signal?: AbortSignal
): Promise<boolean> => {
  const payload = await request<EmailCheckResult>(
    `/users/check-email?email=${encodeURIComponent(email.trim().toLowerCase())}`,
    { signal }
  );

  return Boolean(payload?.exists);
};

/* =========================================================
   Files
   ========================================================= */

export const getFiles = async (): Promise<CloudFile[]> => {
  const payload = await request<unknown>("/files");

  return collectionFrom(payload).map(normalizeFile);
};

export const getFileDetail = async (fileId: string): Promise<FileDetail> => {
  const payload = await request<{
    file: RawFile;
    downloadUrl: string;
    expiresIn: number;
  }>(`/files/${fileId}`);

  return {
    file: normalizeFile(payload.file ?? {}),
    downloadUrl: payload.downloadUrl,
    expiresIn: payload.expiresIn,
  };
};

export const createFile = (
  metadata: FileMetadata
): Promise<CreateFileResponse> =>
  request<CreateFileResponse>("/files", {
    method: "POST",
    body: JSON.stringify(metadata),
  });

export const updateFile = async (
  fileId: string,
  changes: FileUpdate
): Promise<CloudFile> => {
  const payload = await request<{ file: RawFile }>(`/files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });

  return normalizeFile(payload.file ?? {});
};

export const deleteFile = async (fileId: string): Promise<void> => {
  await request(`/files/${fileId}`, { method: "DELETE" });
};

/* =========================================================
   S3 direct upload

   XHR rather than fetch — it's the only way to report real
   byte-level progress back to the UI.
   ========================================================= */

export const uploadToS3 = (
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      reject(
        new ApiError(
          "Your file didn't finish sending. Please try again.",
          xhr.status
        )
      );
    };

    xhr.onerror = () =>
      reject(
        new ApiError(
          "The connection dropped while sending your file. Please try again.",
          0
        )
      );

    xhr.onabort = () => reject(new ApiError("Upload cancelled.", 0));

    xhr.send(file);
  });
