import {Router} from "express";

import {checkUserEmail} from "../controllers/file.controller";
import {authMiddleware} from "../middlewares/auth.middleware";

const router = Router();
router.get(
  "/check-email",
  authMiddleware,
  checkUserEmail
);
export default router;


