import express from "express";
import dotenv from "dotenv";

import fileRoutes from "./src/routes/file.route";

dotenv.config();

const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));


// health

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "CloudForge API is running",
  });
});


// file routes

app.use("/files", fileRoutes);


// 404 handler

app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});


// global error handler

app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled server error:", error);

    res.status(500).json({
      message: "Internal server error",
    });
  }
);


// start server

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(
    `CloudForge API running on port ${PORT}`
  );
});