import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION,

  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const bucket = process.env.S3_BUCKET!;

export async function generateUploadUrl(
  key: string,
  mimeType: string,
  metadata: {
    fileName: string;
    title: string;
    description: string;
    share_to_emails: string[];
  }
) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,

    /*
      S3 user metadata is a flat string map, so the recipient list
      travels as a comma-separated string and is split again by the
      processing lambda.
    */
    Metadata: {
      "file-name": metadata.fileName,
      title: metadata.title,
      description: metadata.description,
      "share-to-emails": (metadata.share_to_emails ?? []).join(","),
    },
  });

  return getSignedUrl(s3, command, {
    expiresIn: 900,
  });
}

export async function generateDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 900,
  });
}

export async function deleteS3Object(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3.send(command);
}