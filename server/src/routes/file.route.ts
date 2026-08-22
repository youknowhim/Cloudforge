import { Router } from "express";

import {
  createFile,
  getFiles,
  getFileById,
  updateFile,
  removeFile,
} from "../controllers/file.controller";

import { authMiddleware } from "../middlewares/auth.middleware";


const router = Router();

/*
  All file APIs require authentication.
*/

router.post(
  "/",
  authMiddleware,
  createFile
);

router.get(
  "/",
  authMiddleware,
  getFiles
);

router.get(
  "/:id",
  authMiddleware,
  getFileById
);

router.patch(
  "/:id",
  authMiddleware,
  updateFile
);

router.delete(
  "/:id",
  authMiddleware,
  removeFile
);

export default router;