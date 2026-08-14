import "dotenv/config";
import { Pool } from "pg";

console.log(
  "DATABASE HOST:",
  process.env.DATABASE_URL?.split("@")[1]
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});