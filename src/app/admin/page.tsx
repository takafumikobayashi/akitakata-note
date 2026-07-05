import Link from "next/link";
import { listPosts } from "@/db/queries";
import { createPostAction } from "./actions";

// 管理トップ: 投稿一覧＋新規作成。実データは D1（Workers 実行時）。
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const posts = await listPosts();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl">投稿</h1>
        <form action={createPostAction}>
          <input type="hidden" name="title" value="" />
          <button
            type="submit"
            className="rounded-sm bg-[color:var(--color-ink)] px-4 py-2 text-sm text-[color:var(--color-paper)]"
          >
            新規作成
          </button>
        </form>
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted)]">まだ投稿がありません。</p>
      ) : (
        <ul className="divide-y divide-[color:var(--color-line)]">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/posts/${p.id}`}
                className="flex items-center justify-between py-3 hover:opacity-70"
              >
                <span className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="text-sm">{p.title ?? "（無題）"}</span>
                </span>
                <span className="text-xs text-[color:var(--color-muted)]">
                  {p.placeName ?? "場所未設定"}
                  <span className="mx-1.5">/</span>
                  {p.mode === "light" ? "軽量" : "通常"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "published" }) {
  const published = status === "published";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        published
          ? "bg-green-100 text-green-800"
          : "bg-[color:var(--color-line)] text-[color:var(--color-muted)]"
      }`}
    >
      {published ? "公開" : "下書き"}
    </span>
  );
}
