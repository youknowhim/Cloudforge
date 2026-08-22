"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const file_controller_1 = require("../controllers/file.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/check-email", auth_middleware_1.authMiddleware, file_controller_1.checkUserEmail);
exports.default = router;
