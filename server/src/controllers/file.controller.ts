import { Response } from "express";
import { randomUUID } from "crypto";

import { pool } from "../database/postgres";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import redis from "../cache/redis";

import {
  generateUploadUrl,
  generateDownloadUrl,
  deleteS3Object,
} from "../aws/s3";

/* =========================================================
   Cached file type
   ========================================================= */

interface CachedFile {
  id: string;
  user_id: string;
  file_name: string;
  title: string;
  description: string;
  mime_type: string;
  size: number;
  s3_key: string;
  public_access: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

/* =========================================================
   POST /files

   Creates a pre-signed S3 upload URL.

   PostgreSQL is NOT updated here.

   Flow:
   React
      ↓
   POST /files
      ↓
   Express
      ↓
   Generate S3 key + pre-signed URL
      ↓
   React
      ↓
   Direct upload to S3
      ↓
   S3 → SQS → Processing Lambda
      ↓
   PostgreSQL INSERT
   ========================================================= */

export async function createFile(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.id;

    const {
      fileName,
      title,
      description = "",
      mimeType,
      size,
      publicAccess = false,
    } = req.body;

    /* ---------- Validation ---------- */

    if (!fileName) {
      return res.status(400).json({
        message: "fileName is required",
      });
    }

    if (!title) {
      return res.status(400).json({
        message: "title is required",
      });
    }

    if (!mimeType) {
      return res.status(400).json({
        message: "mimeType is required",
      });
    }

    if (size === undefined || Number(size) <= 0) {
      return res.status(400).json({
        message: "Valid file size is required",
      });
    }

    if (typeof publicAccess !== "boolean") {
      return res.status(400).json({
        message: "publicAccess must be true or false",
      });
    }

    /* ---------- Generate unique file ID ---------- */

    const fileId = randomUUID();

    /* ---------- Sanitize filename ---------- */

    const safeFileName = String(fileName).replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    /* ---------- Generate S3 object key ---------- */

    const s3Key =
      `users/${userId}/files/${fileId}-${safeFileName}`;

    /* ---------- Generate pre-signed PUT URL ---------- */

    const uploadUrl = await generateUploadUrl(
      s3Key,
      mimeType,
      {
        fileName: String(fileName),
        title: String(title),
        description: String(description),
        publicAccess,
      }
    );

    /* ---------- Return upload information ---------- */

    return res.status(201).json({
      message: "Upload URL generated successfully",

      fileId,

      uploadUrl,

      s3Key,

      expiresIn: 900,

      file: {
        fileName,
        title,
        description,
        mimeType,
        size,
        publicAccess,
      },
    });

  } catch (error) {

    console.error(
      "Create file error:",
      error
    );

    return res.status(500).json({
      message: "Failed to generate upload URL",
    });
  }
}


/* =========================================================
   GET /files

   Returns:
   - Files owned by logged-in user
   - Files marked as public

   Redis cache:
   files:user:{userId}

   TTL: 60 seconds
   ========================================================= */

export async function getFiles(
  req: AuthenticatedRequest,
  res: Response
) {
  try {

    const userId = req.user!.id;

    const cacheKey = `files:user:${userId}`;

    console.log("=================================");
    console.log("GET /files");
    console.log("Cache Key:", cacheKey);

    /* ---------- Check Redis ---------- */

    const cachedFiles =
      await redis.get<CachedFile[]>(cacheKey);

    if (cachedFiles) {

      console.log("🟢 REDIS HIT - GET /files");
      console.log(
        "Cached files count:",
        cachedFiles.length
      );

      return res.status(200).json({
        files: cachedFiles,
      });
    }

    console.log("🔴 REDIS MISS - GET /files");
    console.log("Going to PostgreSQL...");

    /* ---------- PostgreSQL ---------- */

    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        file_name,
        title,
        description,
        mime_type,
        size,
        s3_key,
        public_access,
        status,
        created_at,
        updated_at
      FROM files
      WHERE status = 'clean'
        AND (
          user_id = $1
          OR public_access = TRUE
        )
      ORDER BY created_at DESC
      `,
      [userId]
    );

    console.log(
      "🟡 POSTGRES RESULT - GET /files"
    );

    console.log(
      "Files returned:",
      result.rows.length
    );

    /* ---------- Store in Redis ---------- */

    await redis.set(
      cacheKey,
      result.rows,
      {
        ex: 60,
      }
    );

    console.log(
      "💾 REDIS SET - GET /files"
    );

    console.log(
      "Cached files count:",
      result.rows.length
    );

    console.log(
      "TTL: 60 seconds"
    );

    return res.status(200).json({
      files: result.rows,
    });

  } catch (error) {

    console.error(
      "Get files error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch files",
    });
  }
}


/* =========================================================
   GET /files/:id

   Returns:
   - File metadata
   - 15-minute pre-signed download URL

   Redis cache:
   files:{id}:user:{userId}

   TTL: 60 seconds
   ========================================================= */

export async function getFileById(
  req: AuthenticatedRequest,
  res: Response
) {
  try {

    const userId = req.user!.id;

    const { id } = req.params;

    const cacheKey =
      `files:${id}:user:${userId}`;

    console.log("=================================");
    console.log("GET /files/:id");
    console.log("File ID:", id);
    console.log("User ID:", userId);
    console.log("Cache Key:", cacheKey);

    /* ---------- Check Redis ---------- */

    const cachedFile =
      await redis.get<CachedFile>(cacheKey);

    if (cachedFile) {

      console.log("🟢 REDIS HIT");
      console.log(
        "Cached title:",
        cachedFile.title
      );

      console.log(
        "Cached updatedAt:",
        cachedFile.updated_at
      );

      const downloadUrl =
        await generateDownloadUrl(
          cachedFile.s3_key
        );

      return res.status(200).json({

        file: {
          id: cachedFile.id,
          fileName: cachedFile.file_name,
          title: cachedFile.title,
          description: cachedFile.description,
          mimeType: cachedFile.mime_type,
          size: cachedFile.size,
          publicAccess: cachedFile.public_access,
          status: cachedFile.status,
          createdAt: cachedFile.created_at,
          updatedAt: cachedFile.updated_at,
        },

        downloadUrl,

        expiresIn: 900,
      });
    }

    /* ---------- Redis MISS ---------- */

    console.log("🔴 REDIS MISS");
    console.log(
      "Going to PostgreSQL..."
    );

    /* ---------- PostgreSQL ---------- */

    const result = await pool.query(
      `
      SELECT
        id,
        user_id,
        file_name,
        title,
        description,
        mime_type,
        size,
        s3_key,
        public_access,
        status,
        created_at,
        updated_at
      FROM files
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {

      console.log(
        "❌ PostgreSQL: File not found"
      );

      return res.status(404).json({
        message: "File not found",
      });
    }

    const file = result.rows[0];

    console.log(
      "🟡 POSTGRES RESULT"
    );

    console.log(
      "Postgres title:",
      file.title
    );

    console.log(
      "Postgres updatedAt:",
      file.updated_at
    );

    /* ---------- Authorization ---------- */

    const isOwner =
      String(file.user_id) === String(userId);

    if (!isOwner && !file.public_access) {

      console.log(
        "❌ Authorization failed"
      );

      return res.status(403).json({
        message:
          "You are not allowed to access this file",
      });
    }

    /* ---------- Status check ---------- */

    if (file.status !== "clean") {

      return res.status(409).json({
        message:
          "File is still being processed",

        status: file.status,
      });
    }

    /* ---------- Cache metadata ---------- */

    await redis.set(
      cacheKey,
      file,
      {
        ex: 60,
      }
    );

    console.log("💾 REDIS SET");
    console.log(
      "Cached title:",
      file.title
    );

    console.log(
      "Cached updatedAt:",
      file.updated_at
    );

    console.log(
      "TTL: 60 seconds"
    );

    /* ---------- Generate fresh signed URL ---------- */

    const downloadUrl =
      await generateDownloadUrl(
        file.s3_key
      );

    return res.status(200).json({

      file: {
        id: file.id,
        fileName: file.file_name,
        title: file.title,
        description: file.description,
        mimeType: file.mime_type,
        size: file.size,
        publicAccess: file.public_access,
        status: file.status,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
      },

      downloadUrl,

      expiresIn: 900,
    });

  } catch (error) {

    console.error(
      "Get file by ID error:",
      error
    );

    return res.status(500).json({
      message: "Failed to fetch file",
    });
  }
}


/* =========================================================
   PATCH /files/:id

   Owner can change:
   - title
   - description
   - publicAccess

   After PostgreSQL update:
   - Invalidate individual file cache
   - Invalidate user's files list cache
   ========================================================= */

export async function updateFile(
  req: AuthenticatedRequest,
  res: Response
) {
  try {

    const userId = req.user!.id;

    const { id } = req.params;

    const {
      title,
      description,
      publicAccess,
    } = req.body;

    console.log("=================================");
    console.log("PATCH /files/:id");
    console.log("File ID:", id);
    console.log("User ID:", userId);

    /* ---------- Check ownership ---------- */

    const existing = await pool.query(
      `
      SELECT id
      FROM files
      WHERE id = $1
        AND user_id = $2
      `,
      [id, userId]
    );

    if (existing.rows.length === 0) {

      console.log(
        "❌ File not found / not owner"
      );

      return res.status(404).json({
        message: "File not found",
      });
    }

    /* ---------- Validate update ---------- */

    if (
      title === undefined &&
      description === undefined &&
      publicAccess === undefined
    ) {

      return res.status(400).json({
        message: "Nothing to update",
      });
    }

    if (
      publicAccess !== undefined &&
      typeof publicAccess !== "boolean"
    ) {

      return res.status(400).json({
        message:
          "publicAccess must be true or false",
      });
    }

    /* ---------- Update PostgreSQL ---------- */

    const result = await pool.query(
      `
      UPDATE files
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        public_access = COALESCE($3, public_access),
        updated_at = NOW()
      WHERE id = $4
        AND user_id = $5

      RETURNING
        id,
        file_name,
        title,
        description,
        mime_type,
        size,
        public_access,
        status,
        created_at,
        updated_at
      `,
      [
        title ?? null,
        description ?? null,
        publicAccess ?? null,
        id,
        userId,
      ]
    );

    console.log(
      "🟡 POSTGRES UPDATE SUCCESS"
    );

    console.log(
      "Updated title:",
      result.rows[0].title
    );

    console.log(
      "Updated updatedAt:",
      result.rows[0].updated_at
    );

    /* ---------- Redis invalidation ---------- */

    const individualCacheKey =
      `files:${id}:user:${userId}`;

    const listCacheKey =
      `files:user:${userId}`;

    console.log(
      "🗑️ INVALIDATING REDIS"
    );

    console.log(
      "Deleting:",
      individualCacheKey
    );

    await redis.del(
      individualCacheKey
    );

    console.log(
      "Deleting:",
      listCacheKey
    );

    await redis.del(
      listCacheKey
    );

    console.log(
      "✅ REDIS INVALIDATION COMPLETE"
    );

    return res.status(200).json({

      message:
        "File updated successfully",

      file: result.rows[0],
    });

  } catch (error) {

    console.error(
      "Update file error:",
      error
    );

    return res.status(500).json({
      message: "Failed to update file",
    });
  }
}


/* =========================================================
   DELETE /files/:id

   1. Check ownership
   2. Delete object from S3
   3. Delete record from PostgreSQL
   ========================================================= */

export async function removeFile(
  req: AuthenticatedRequest,
  res: Response
) {
  try {

    const userId = req.user!.id;

    const { id } = req.params;

    console.log("=================================");
    console.log("DELETE /files/:id");
    console.log("File ID:", id);
    console.log("User ID:", userId);

    /* ---------- Find file ---------- */

    const result = await pool.query(
      `
      SELECT
        id,
        s3_key
      FROM files
      WHERE id = $1
        AND user_id = $2
      `,
      [id, userId]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        message: "File not found",
      });
    }

    const s3Key =
      result.rows[0].s3_key;

    /* ---------- Delete S3 object ---------- */

    await deleteS3Object(s3Key);

    /* ---------- Delete PostgreSQL record ---------- */

    await pool.query(
      `
      DELETE FROM files
      WHERE id = $1
        AND user_id = $2
      `,
      [id, userId]
    );

    /* ---------- Invalidate Redis ---------- */

    const individualCacheKey =
      `files:${id}:user:${userId}`;

    const listCacheKey =
      `files:user:${userId}`;

    await redis.del(
      individualCacheKey
    );

    await redis.del(
      listCacheKey
    );

    console.log(
      "🗑️ Redis cache invalidated after DELETE"
    );

    return res.status(200).json({
      message:
        "File deleted successfully",
    });

  } catch (error) {

    console.error(
      "Delete file error:",
      error
    );

    return res.status(500).json({
      message: "Failed to delete file",
    });
  }
}