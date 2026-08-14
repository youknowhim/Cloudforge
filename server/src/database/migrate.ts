import fs from "fs";
import path from "path";
import { pool } from "./postgres";

async function migrate() {
  const migrationPath = path.join(
    __dirname,
    "migrations",
    "002file-public-access.sql"
  );

  const sql = fs.readFileSync(
    migrationPath,
    "utf-8"
  );

  try {
    await pool.query(sql);

    console.log("Database migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();