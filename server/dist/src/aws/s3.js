"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateUploadUrl = generateUploadUrl;
exports.generateDownloadUrl = generateDownloadUrl;
exports.deleteS3Object = deleteS3Object;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3 = new client_s3_1.S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});
const bucket = process.env.S3_BUCKET;
async function generateUploadUrl(key, mimeType, metadata) {
    const command = new client_s3_1.PutObjectCommand({
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
    return (0, s3_request_presigner_1.getSignedUrl)(s3, command, {
        expiresIn: 900,
    });
}
async function generateDownloadUrl(key) {
    const command = new client_s3_1.GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(s3, command, {
        expiresIn: 900,
    });
}
async function deleteS3Object(key) {
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    await s3.send(command);
}
