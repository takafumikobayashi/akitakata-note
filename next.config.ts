import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 写真主役。画像最適化は本番では Cloudflare 側(R2 + Image Transformations, ADR-0003)に寄せる。
  reactStrictMode: true,
};

export default nextConfig;

// ローカル開発で Cloudflare バインディング(D1/R2 等)を getCloudflareContext() から使えるようにする。
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
