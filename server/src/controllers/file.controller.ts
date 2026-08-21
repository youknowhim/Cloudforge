import { Response } from "express";
import { randomUUID } from "crypto";

import { pool } from "../database/postgres";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import  redis  from "../cache/redis";

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

interface CachedFile {
  id: string;
  user_id: string;
  file_name: string;
  title: string;
  description: string;
  mime_type: string;
  size: number;
  s3_key: string;
  share_to_emails: string[];
  status: string;
  created_at: string;
  updated_at: string;

  owner_name?: string;
  owner_email?: string;
}

export async function checkUserEmail(
  req: AuthenticatedRequest,
  res: Response
) {

  try {
    const email = String(req.query.email || "");

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const result = await pool.query(
      `
      SELECT 1
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );

    return res.status(200).json({
      exists: result.rows.length > 0,
    });

  } catch (error) {
    console.error(
      "Check user email error:",
      error
    );

    return res.status(500).json({
      message: "Failed to check email",
    });
  }
}

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
      share_to_emails = [],
      mimeType,
      size,
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
        share_to_emails:share_to_emails,
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
        share_to_emails,
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
    const email = req.user!.email;
    const cacheKey = `files:user:${userId}`;

    // 1. Check Redis
    const cachedFiles = await redis.get<CachedFile[]>(cacheKey);

    if (cachedFiles) {

      return res.status(200).json({
        files: cachedFiles,
      });
    }

    const result = await pool.query(
  `
  SELECT
    f.id,
    f.user_id,
    f.file_name,
    f.title,
    f.description,
    f.mime_type,
    f.size,
    f.s3_key,
    f.share_to_emails,
    f.status,
    f.created_at,
    f.updated_at,

    u.name AS owner_name,
    u.email AS owner_email

  FROM files f

  JOIN users u
    ON u.id = f.user_id

  WHERE f.status = 'clean'
    AND (
      f.user_id = $1
      OR f.share_to_emails @> $2::jsonb
    )

  ORDER BY f.created_at DESC
  `,
  /* jsonb containment needs the email as a JSON scalar: "a@b.com" */
  [userId, JSON.stringify(email)]
);


   const files = result.rows as CachedFile[];

const responseFiles = files.map((file) => {
  const isOwner =
    String(file.user_id) === String(userId);

  if (isOwner) {
    return {
      id: file.id,
      fileName: file.file_name,
      title: file.title,
      description: file.description,
      mimeType: file.mime_type,
      size: file.size,
      sharedWith: file.share_to_emails || [],
      status: file.status,
      createdAt: file.created_at,
      updatedAt: file.updated_at,
    };
  }

  return {
    id: file.id,
    fileName: file.file_name,
    title: file.title,
    description: file.description,
    mimeType: file.mime_type,
    size: file.size,
    sharedBy: {
      name: file.owner_name,
      email: file.owner_email,
    },
    status: file.status,
    createdAt: file.created_at,
    updatedAt: file.updated_at,
  };
});

    await redis.set(
      cacheKey,
      responseFiles,
      {
        ex: 60,
      }
    );

return res.status(200).json({
  files: responseFiles,
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

    const cacheKey = `files:${id}:user:${userId}`;

const cachedFile = await redis.get<{
  responseFile: string;
  downloadUrl: string;
}>(cacheKey);

if (cachedFile) {
  return res.status(200).json({
    file: cachedFile.responseFile,
    downloadUrl: cachedFile.downloadUrl,
    expiresIn: 900,
  });
}

      // 2. Redis miss --> PostgreSQL
const result = await pool.query(
  `
  SELECT
    f.id,
    f.user_id,
    f.file_name,
    f.title,
    f.description,
    f.mime_type,
    f.size,
    f.s3_key,
    f.share_to_emails,
    f.status,
    f.created_at,
    f.updated_at,

    u.name AS owner_name,
    u.email AS owner_email

  FROM files f

  JOIN users u
    ON u.id = f.user_id

  WHERE f.id = $1
    AND (
      f.user_id = $2
      OR f.share_to_emails @> $3::jsonb
    )
  `,
  [id, userId, JSON.stringify(req.user!.email)]
);
      


      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "File not found",
        });
      }

      const file = result.rows[0];
      const isOwner =
  String(file.user_id) === String(userId);

const responseFile = {
  id: file.id,
  fileName: file.file_name,
  title: file.title,
  description: file.description,
  mimeType: file.mime_type,
  size: file.size,
  status: file.status,
  createdAt: file.created_at,
  updatedAt: file.updated_at,

  ...(isOwner
    ? {
        sharedWith: file.share_to_emails || [],
      }
    : {
        sharedBy: {
          name: file.owner_name,
          email: file.owner_email,
        },
      }),
};

      if (file.status !== "clean") {
        return res.status(409).json({
          message: "File is still being processed",
          status: file.status,
        });
      }

    // 5. Generate fresh signed URL
    const downloadUrl =
      await generateDownloadUrl(file.s3_key);
            // 4. Cache metadata
      await redis.set(
        cacheKey,
        { responseFile, downloadUrl },
        {
          ex: 60,
        }
      );

    return res.status(200).json({
      file: responseFile,

      downloadUrl,
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
   - share_to_emails
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
      share_to_emails,
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
        message: "Either File not found or you are not the owner",
      });
    }


    /* ---------- Validate update ---------- */

    if (
      title === undefined &&
      description === undefined &&
      share_to_emails === undefined
    ) {
      return res.status(400).json({
        message: "Nothing to update",
      });
    }


    /* ---------- Update PostgreSQL ---------- */

    const result = await pool.query(
      `
      UPDATE files
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        share_to_emails = COALESCE($3::jsonb, share_to_emails),
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
        share_to_emails,
        status,
        created_at,
        updated_at
      `,
      [
        title ?? null,
        description ?? null,
        /* jsonb column — send the array as JSON, not a PG array literal */
        share_to_emails === undefined || share_to_emails === null
          ? null
          : JSON.stringify(share_to_emails),
        id,
        userId,
      ]
    );
    await redis.del(`files:${id}:user:${userId}`);
    await redis.del(`files:user:${userId}`);

    const updated = result.rows[0];

    return res.status(200).json({
      message: "File updated successfully",

      file: {
        id: updated.id,
        fileName: updated.file_name,
        title: updated.title,
        description: updated.description,
        mimeType: updated.mime_type,
        size: updated.size,
        sharedWith: updated.share_to_emails || [],
        status: updated.status,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
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

    await redis.del(`files:${id}:user:${userId}`);
    await redis.del(`files:user:${userId}`);

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