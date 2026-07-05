import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin-auth";

// 管理UIシェル（運営者のみ・requireAdmin で保護）。公開面とは別トーンの実務的な画面。
export const metadata = { title: "管理", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--color-line)]">
        <div className="mx-auto flex max-w-4xl items-baseline justify-between px-6 py-4">
          <Link href="/admin" className="text-base tracking-wide">
            あきたかたノート <span className="text-[color:var(--color-muted)]">管理</span>
          </Link>
          <Link href="/" className="text-sm text-[color:var(--color-muted)]">
            サイトを見る
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
