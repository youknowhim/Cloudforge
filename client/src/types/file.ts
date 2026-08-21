/*
  `clean` is what the processing lambda writes once a file has been
  accepted. `processing` never comes from the API — it is the local
  placeholder the UI shows between "upload finished" and "the lambda
  has written the row".
*/
export type FileStatus = "processing" | "clean" | "failed";

export interface FileOwner {
  name?: string;
  email?: string;
}

export interface CloudFile {
  id: string;
  userId: string;

  fileName: string;
  title: string;
  description: string;

  mimeType: string;
  size: number;

  s3Key?: string;

  /* the API returns exactly one of these two, never both */
  sharedWith: string[];
  sharedBy?: FileOwner;

  status: FileStatus;

  createdAt?: string;
  updatedAt?: string;

  /* true only for the optimistic card shown right after an upload */
  pending?: boolean;
}

export interface FileMetadata {
  fileName: string;
  title: string;
  description: string;
  mimeType: string;
  size: number;
  share_to_emails: string[];
}

export interface CreateFileResponse {
  message: string;
  fileId: string;
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface FileDetail {
  file: CloudFile;
  downloadUrl: string;
  expiresIn: number;
}

export interface FileUpdate {
  title?: string;
  description?: string;
  share_to_emails?: string[];
}

export interface EmailCheckResult {
  exists: boolean;
}
