"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const postgres_1 = require("./postgres");
async function migrate() {
    const migrationPath = path_1.default.join(__dirname, "migrations", "002file-public-access.sql");
    const sql = fs_1.default.readFileSync(migrationPath, "utf-8");
    try {
        await postgres_1.pool.query(sql);
        console.log("Database migration completed successfully.");
    }
    catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
    finally {
        await postgres_1.pool.end();
    }
}
migrate();
