export type FileStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface CloudFile {
  id: string;
  userId: string;

  fileName: string;
  title: string;
  description: string;

  mimeType: string;
  size: number;

  s3Key?: string;

  publicAccess: boolean;
  status: FileStatus;

  createdAt?: string;
  updatedAt?: string;
}

export interface FileMetadata {
  fileName: string;
  title: string;
  description: string;
  mimeType: string;
  size: number;
  publicAccess: boolean;
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
  publicAccess?: boolean;
}
