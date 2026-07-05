import { HeroCarousel } from "@/components/hero-carousel";

// トップページ（写真主役）。ヒーローは有機マスク＋クロスフェードのカルーセル。
// 新着カードの写真枠・実データ(Post/Place/Media)接続は Step 2 以降（画像は ADR-0003 の R2 派生）。

type SamplePost = {
  title: string;
  place: string;
  season: string;
};

const recent: SamplePost[] = [
  { title: "毛利家家紋と展望台", place: "郡山城跡", season: "春" },
  { title: "神楽門前湯治村へ", place: "神楽門前湯治村", season: "春" },
  { title: "向こう側に広がる桜の帯", place: "土師ダム", season: "春" },
  { title: "神秘的な朝もや", place: "吉田町吉田", season: "春" },
  { title: "美味すぎてビックリしました", place: "お好み焼きハチヤ", season: "通年" },
  { title: "エモすぎる建築", place: "旧郷野小学校", season: "冬" },
];

function PhotoFrame() {
  // 写真が入る枠。実装では next/image + R2 派生画像に置き換える。
  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center rounded-sm bg-[color:var(--color-line)]">
      <span className="text-xs tracking-widest text-[color:var(--color-muted)]/60">
        写真
      </span>
    </div>
  );
}

function PostCard({ post }: { post: SamplePost }) {
  return (
    <article className="group">
      <PhotoFrame />
      <h3 className="mt-3 text-base leading-snug">{post.title}</h3>
      <p className="mt-1 text-xs text-[color:var(--color-muted)]">
        {post.place}
        <span className="mx-1.5 text-[color:var(--color-line)]">/</span>
        {post.season}
      </p>
    </article>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* ヘッダー（グローバルナビ, 14 §5-7）。写真を邪魔しない静かなヘッダー */}
      <header className="mx-auto flex max-w-5xl items-baseline justify-between px-6 py-6">
        <span className="text-lg tracking-wide">あきたかたノート</span>
        <nav className="flex gap-x-6 text-sm text-[color:var(--color-muted)]">
          <span>地図</span>
          <span>季節</span>
          <span>テーマ</span>
          <span>新着</span>
        </nav>
      </header>

      {/* ヒーロー: フルブリードの主役写真カルーセル（横広・無造作な縁・スライド） */}
      <HeroCarousel />

      <main className="mx-auto max-w-5xl px-6 pb-24">
        {/* 静かなキャプション（写真の下へ、フィールドノート的に） */}
        <section className="mt-8">
          <h1 className="text-xl leading-relaxed text-[color:var(--color-muted)] sm:text-2xl">
            安芸高田市の、いまの空気と暮らしの解像度を。
          </h1>
        </section>

        {/* 新着（カードグリッド）。写真サムネ + タイトル + 場所・季節 */}
        <section className="mt-16">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-lg">新着</h2>
            <span className="text-sm text-[color:var(--color-muted)]">
              すべて見る
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((post) => (
              <PostCard key={post.title} post={post} />
            ))}
          </div>
        </section>
      </main>

      {/* 非公式性フッター（05 §3-3 / §6-3） */}
      <footer className="border-t border-[color:var(--color-line)]">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs leading-relaxed text-[color:var(--color-muted)]">
          運営者個人による記録であり、行政・自治体の公式見解を代表するものではありません。
          <span className="mx-2">/</span>
          文・写真: コバッチ
        </div>
      </footer>
    </div>
  );
}
