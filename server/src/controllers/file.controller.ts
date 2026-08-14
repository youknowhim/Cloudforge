import { Response } from "express";
import { randomUUID } from "crypto";

import { pool } from "../database/postgres";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

import {
  generateUploadUrl,
  generateDownloadUrl,
  deleteS3Object,
} from "../aws/s3";


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
   - Files owned by the logged-in user
   - Files marked as public

   Only COMPLETED files are returned.
   ========================================================= */

export async function getFiles(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.id;

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
      WHERE status = 'COMPLETED'
        AND (
          user_id = $1
          OR public_access = TRUE
        )
      ORDER BY created_at DESC
      `,
      [userId]
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

   Access:
   - Owner can access
   - Other users can access only if public_access = true
   ========================================================= */

export async function getFileById(
  req: AuthenticatedRequest,
  res: Response
) {
  try {
    const userId = req.user!.id;

    const { id } = req.params;


    /* ---------- Get file from PostgreSQL ---------- */

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
      return res.status(404).json({
        message: "File not found",
      });
    }


    const file = result.rows[0];


    /* ---------- Authorization ---------- */

    const isOwner =
      String(file.user_id) === String(userId);


    if (!isOwner && !file.public_access) {
      return res.status(403).json({
        message: "You are not allowed to access this file",
      });
    }


    /* ---------- Check processing status ---------- */

    if (file.status !== "COMPLETED") {
      return res.status(409).json({
        message: "File is still being processed",
        status: file.status,
      });
    }


    /* ---------- Generate S3 download URL ---------- */

    const downloadUrl =
      await generateDownloadUrl(file.s3_key);


    /* ---------- Return metadata + URL ---------- */

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
        message: "publicAccess must be true or false",
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


    return res.status(200).json({
      message: "File updated successfully",
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


    const s3Key = result.rows[0].s3_key;


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


    return res.status(200).json({
      message: "File deleted successfully",
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