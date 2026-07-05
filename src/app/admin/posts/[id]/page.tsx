import { notFound } from "next/navigation";
import { evaluateGate, getPostForEdit, getTaxonomy, type EditorMedia } from "@/db/queries";
import {
  deleteMediaAction,
  publishAction,
  saveChecklistAction,
  savePostAction,
  saveSafetyReviewAction,
  unpublishAction,
  uploadMediaAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const REVIEW_OPTS = [
  { v: "unreviewed", l: "未確認" },
  { v: "confirmed", l: "確認済" },
];
const FACE_OPTS = [
  { v: "unreviewed", l: "未確認" },
  { v: "not_needed", l: "不要（人物なし）" },
  { v: "confirmed", l: "確定" },
];

export default async function PostEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (Number.isNaN(id)) notFound();

  const [data, tax, gate] = await Promise.all([
    getPostForEdit(id),
    getTaxonomy(),
    evaluateGate(id),
  ]);
  if (!data || !gate) notFound();
  const { post, themeSlugs, tagIds, media, checklist } = data;
  const published = post.status === "published";

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl">{post.title ?? "（無題）"}</h1>
        <span className="text-xs text-[color:var(--color-muted)]">/{post.slug}</span>
      </div>

      {/* 公開ゲート */}
      <section
        className={`rounded-sm border p-4 ${
          gate.canPublish ? "border-green-300 bg-green-50" : "border-amber-300 bg-amber-50"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base">
            {published ? "公開中" : gate.canPublish ? "公開できます" : "公開できません"}
          </h2>
          <div className="flex gap-2">
            {published ? (
              <form action={unpublishAction.bind(null, id)}>
                <button className="rounded-sm border border-[color:var(--color-line)] px-3 py-1.5 text-sm">
                  下書きに戻す
                </button>
              </form>
            ) : (
              <form action={publishAction.bind(null, id)}>
                <button
                  disabled={!gate.canPublish}
                  className="rounded-sm bg-[color:var(--color-ink)] px-3 py-1.5 text-sm text-[color:var(--color-paper)] disabled:opacity-40"
                >
                  公開する
                </button>
              </form>
            )}
          </div>
        </div>
        {!gate.canPublish && (
          <ul className="mt-3 space-y-1 text-sm text-amber-900">
            {gate.reasons.map((r) => (
              <li key={r}>・{r}</li>
            ))}
          </ul>
        )}
      </section>

      {/* 投稿フィールド */}
      <form action={savePostAction.bind(null, id)} className="space-y-4">
        <h2 className="text-base">投稿内容</h2>
        <Field label="タイトル">
          <input name="title" defaultValue={post.title ?? ""} className={inputCls} />
        </Field>
        <Field label="本文">
          <textarea name="body" defaultValue={post.body ?? ""} rows={6} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="種別">
            <select name="mode" defaultValue={post.mode} className={inputCls}>
              <option value="standard">通常</option>
              <option value="light">軽量</option>
            </select>
          </Field>
          <Field label="撮影日">
            <input type="date" name="shootingDate" defaultValue={post.shootingDate ?? ""} className={inputCls} />
          </Field>
          <Field label="季節">
            <select name="seasonSlug" defaultValue={post.seasonSlug ?? ""} className={inputCls}>
              <option value="">—</option>
              {tax.seasons.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="時間帯">
            <select name="timeOfDay" defaultValue={post.timeOfDay ?? ""} className={inputCls}>
              <option value="">—</option>
              <option value="morning">朝</option>
              <option value="noon">昼</option>
              <option value="evening">夕</option>
              <option value="night">夜</option>
            </select>
          </Field>
          <Field label="場所">
            <select name="placeId" defaultValue={post.placeId ?? ""} className={inputCls}>
              <option value="">—</option>
              {tax.places.map((p) => (
                <option key={p.id} value={p.id}>{p.name}（{p.baseLocationLevel}）</option>
              ))}
            </select>
          </Field>
          <Field label="公開レベル上書き">
            <select name="locationLevelOverride" defaultValue={post.locationLevelOverride ?? ""} className={inputCls}>
              <option value="">Place既定に従う</option>
              {["A", "B", "C", "D"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="mapDisplay" defaultChecked={post.mapDisplay ?? false} />
          地図に表示する
        </label>

        <Field label="テーマ（複数可）">
          <div className="flex flex-wrap gap-3">
            {tax.themes.map((th) => (
              <label key={th.slug} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="themes" value={th.slug} defaultChecked={themeSlugs.includes(th.slug)} />
                {th.name}
              </label>
            ))}
          </div>
        </Field>
        {tax.tags.length > 0 && (
          <Field label="タグ">
            <div className="flex flex-wrap gap-3">
              {tax.tags.map((tg) => (
                <label key={tg.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="tags" value={tg.id} defaultChecked={tagIds.includes(tg.id)} />
                  {tg.name}
                </label>
              ))}
            </div>
          </Field>
        )}
        <button className="rounded-sm border border-[color:var(--color-line)] px-4 py-2 text-sm">
          投稿内容を保存
        </button>
      </form>

      {/* 画像＋画像単位の安全確認 */}
      <section className="space-y-4">
        <h2 className="text-base">画像と安全確認</h2>
        <form action={uploadMediaAction.bind(null, id)} className="flex items-end gap-3">
          <Field label="画像を追加（アップロード時にEXIF/GPS除去＋自動検査）">
            <input type="file" name="file" accept="image/*" className="text-sm" />
          </Field>
          <button className="rounded-sm border border-[color:var(--color-line)] px-4 py-2 text-sm">
            アップロード
          </button>
        </form>

        {media.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted)]">画像がありません。</p>
        ) : (
          <div className="space-y-6">
            {media.map((m) => (
              <MediaReview key={m.id} postId={id} media={m} />
            ))}
          </div>
        )}
      </section>

      {/* 投稿単位の公開前チェック */}
      <form action={saveChecklistAction.bind(null, id)} className="space-y-4">
        <h2 className="text-base">公開前チェック（投稿単位）</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="地図表示は適切か">
            <SelectOpts name="mapDisplayOk" value={checklist?.mapDisplayOk ?? "unreviewed"} opts={REVIEW_OPTS} />
          </Field>
          <Field label="公開レベルは妥当か">
            <SelectOpts name="locationLevelOk" value={checklist?.locationLevelOk ?? "unreviewed"} opts={REVIEW_OPTS} />
          </Field>
        </div>
        <p className="text-xs text-[color:var(--color-muted)]">
          EXIF/GPS除去は自動検査で担保（手入力項目ではありません）。全画像の安全確認が揃うと media_safety_cleared が成立します。
        </p>
        <button className="rounded-sm border border-[color:var(--color-line)] px-4 py-2 text-sm">
          チェックを保存
        </button>
      </form>
    </div>
  );
}

function MediaReview({ postId, media }: { postId: number; media: EditorMedia }) {
  const r = media.review;
  return (
    <div className="flex gap-4 rounded-sm border border-[color:var(--color-line)] p-4">
      <div className="w-40 shrink-0">
        {media.publicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.publicUrl} alt={media.alt ?? media.filename} className="w-full rounded-sm object-cover" />
        ) : (
          <div className="flex aspect-[3/2] items-center justify-center bg-[color:var(--color-line)] text-xs text-[color:var(--color-muted)]">
            処理中
          </div>
        )}
        <p className="mt-1 truncate text-xs text-[color:var(--color-muted)]">{media.filename}</p>
        <div className="mt-1 text-xs">
          EXIF/GPS: {r?.exifGpsOk ? <span className="text-green-700">除去済み（自動検査）</span> : <span className="text-amber-700">未確認</span>}
        </div>
        <form action={deleteMediaAction.bind(null, postId, media.id)} className="mt-2">
          <button className="text-xs text-red-700 hover:underline">削除</button>
        </form>
      </div>

      <form action={saveSafetyReviewAction.bind(null, postId, media.id)} className="grid flex-1 grid-cols-2 gap-3">
        <Field label="人物写り込み">
          <SelectOpts name="faceOk" value={r?.faceOk ?? "unreviewed"} opts={FACE_OPTS} />
        </Field>
        <Field label="子ども・少人数">
          <SelectOpts name="childMinorOk" value={r?.childMinorOk ?? "unreviewed"} opts={REVIEW_OPTS} />
        </Field>
        <Field label="表札・ナンバー">
          <SelectOpts name="nameplatePlateOk" value={r?.nameplatePlateOk ?? "unreviewed"} opts={REVIEW_OPTS} />
        </Field>
        <Field label="私有地・生活導線">
          <SelectOpts name="privateLifeOk" value={r?.privateLifeOk ?? "unreviewed"} opts={REVIEW_OPTS} />
        </Field>
        <Field label="ランドマーク地点特定">
          <SelectOpts name="landmarkLevelOk" value={r?.landmarkLevelOk ?? "unreviewed"} opts={REVIEW_OPTS} />
        </Field>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" name="ogpOk" defaultChecked={media.ogpOk} />
          OGP/サムネに使える
        </label>
        <div className="col-span-2">
          <button className="rounded-sm border border-[color:var(--color-line)] px-3 py-1.5 text-sm">
            この画像の確認を保存
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-sm border border-[color:var(--color-line)] bg-white px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[color:var(--color-muted)]">{label}</span>
      {children}
    </label>
  );
}

function SelectOpts({
  name,
  value,
  opts,
}: {
  name: string;
  value: string;
  opts: { v: string; l: string }[];
}) {
  return (
    <select name={name} defaultValue={value} className={inputCls}>
      {opts.map((o) => (
        <option key={o.v} value={o.v}>{o.l}</option>
      ))}
    </select>
  );
}
