/**
 * D1 クライアント。Workers 実行時に getCloudflareContext().env.DB を Drizzle でラップする。
 * バインディング DB は wrangler.jsonc / CloudflareEnv（cf-typegen）で定義。
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
