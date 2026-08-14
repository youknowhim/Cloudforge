import { Request, Response, NextFunction } from "express";


/* =========================================================
   TypeScript types
   ========================================================= */

export interface AuthenticatedUser {
  id: string;
  email?: string;
}


export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}


/* =========================================================
   Authentication Middleware
   ========================================================= */

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {

    /*
     * API Gateway has already verified the JWT.
     *
     * We expect API Gateway to forward the authenticated
     * user's identity to Express.
     */

    const userId = req.header("X-User-Id");
    const email = req.header("X-User-Email");


    /* ---------- No authenticated user ---------- */

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }


    /* ---------- Create req.user ---------- */

    req.user = {
      id: userId,
      email,
    };


    /* ---------- Continue to controller ---------- */

    next();

  } catch (error) {

    console.error(
      "Authentication middleware error:",
      error
    );

    return res.status(401).json({
      message: "Unauthorized",
    });
  }
}