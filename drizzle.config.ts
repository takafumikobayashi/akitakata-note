import { defineConfig } from "drizzle-kit";

// Cloudflare D1(SQLite) 用。マイグレーションSQLを ./drizzle に生成し、
// 適用は wrangler d1 migrations apply（ローカル/リモート）で行う。
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
