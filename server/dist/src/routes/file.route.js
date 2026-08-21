"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const file_controller_1 = require("../controllers/file.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
/*
  All file APIs require authentication.
*/
router.post("/", auth_middleware_1.authMiddleware, file_controller_1.createFile);
router.get("/", auth_middleware_1.authMiddleware, file_controller_1.getFiles);
router.get("/:id", auth_middleware_1.authMiddleware, file_controller_1.getFileById);
router.patch("/:id", auth_middleware_1.authMiddleware, file_controller_1.updateFile);
router.delete("/:id", auth_middleware_1.authMiddleware, file_controller_1.removeFile);
exports.default = router;
