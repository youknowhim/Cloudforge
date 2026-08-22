"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const file_route_1 = __importDefault(require("./src/routes/file.route"));
const user_route_1 = __importDefault(require("./src/routes/user.route"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)({
    origin: "https://cloudforge-coral-theta.vercel.app",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
// health
app.get("/", (_req, res) => {
    res.status(200).json({
        message: "CloudForge API is running",
    });
});
app.use((_req, res, next) => {
    console.log("API Gateway → Express:", _req.method, _req.originalUrl);
    console.log("Headers:", _req.headers);
    next();
});
// file routes
app.use("/files", file_route_1.default);
app.use("/users", user_route_1.default);
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        message: "Route not found",
    });
});
// global error handler
app.use((error, _req, res, _next) => {
    console.error("Unhandled server error:", error);
    res.status(500).json({
        message: "Internal server error",
    });
});
// start server
const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => {
    console.log(`CloudForge API running on port ${PORT}`);
});
