/**
 * 公開派生の配信ルート（DERIVATIVES_PUBLIC_BASE 未設定時のフォールバック経路）。
 * R2 公開バケット(DERIVATIVES)から EXIF除去済みの派生のみを返す。原本(ORIGINALS)には触れない。
 * 本番で R2 カスタムドメインを張る場合はそちら優先（mediaPublicUrl）。
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const objectKey = key.join("/");

  // 配信対象は派生のみ。原本プレフィックスや外れたキーは拒否
  if (!objectKey.startsWith("derivatives/")) {
    return new Response("Not found", { status: 404 });
  }

  const { env } = getCloudflareContext();
  const obj = await env.DERIVATIVES.get(objectKey);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
}
