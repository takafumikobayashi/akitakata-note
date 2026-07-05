import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Next.js(App Router) を Cloudflare Workers で動かす（ADR-0001）。
// キャッシュ/ISR の incremental cache 等は D1/R2/KV 導入時（Step 2〜）に追加する。
export default defineCloudflareConfig();
