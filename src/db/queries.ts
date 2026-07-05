/**
 * 管理UI/公開面が使う D1 アクセス層（Drizzle）。
 * 公開ゲートの判定材料は loadGateInput でまとめ、evaluatePublishGate に渡す。
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./index";
import * as t from "./schema";
import {
  computeMediaSafetyCleared,
  evaluatePublishGate,
  type PublishGateInput,
  type PublishGateResult,
  type SafetyReviewState,
} from "@/lib/publish-gate";

/* ── 参照系（フォームの選択肢） ── */

export async function getTaxonomy() {
  const db = getDb();
  const [seasons, themes, tags, places] = await Promise.all([
    db.select().from(t.seasons).orderBy(t.seasons.sortOrder),
    db.select().from(t.themes).orderBy(t.themes.sortOrder),
    db.select().from(t.tags).orderBy(t.tags.name),
    db.select().from(t.places).orderBy(t.places.name),
  ]);
  return { seasons, themes, tags, places };
}

export type PostListRow = {
  id: number;
  slug: string;
  title: string | null;
  status: "draft" | "published";
  mode: "light" | "standard";
  placeName: string | null;
};

export async function listPosts(): Promise<PostListRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: t.posts.id,
      slug: t.posts.slug,
      title: t.posts.title,
      status: t.posts.status,
      mode: t.posts.mode,
      placeName: t.places.name,
    })
    .from(t.posts)
    .leftJoin(t.places, eq(t.posts.placeId, t.places.id))
    .orderBy(desc(t.posts.createdAt));
  return rows;
}

export type EditorMedia = {
  id: number;
  filename: string;
  publicUrl: string | null;
  ord: number;
  alt: string | null;
  review: SafetyReviewState | null;
  /** OGP適性（公開ゲート非対象だが保存値を保持するため別に持つ） */
  ogpOk: boolean;
};

export type EditorData = {
  post: typeof t.posts.$inferSelect;
  themeSlugs: string[];
  tagIds: number[];
  media: EditorMedia[];
  checklist: typeof t.publishChecklists.$inferSelect | null;
};

function toReviewState(r: typeof t.safetyReviews.$inferSelect): SafetyReviewState {
  return {
    exifGpsOk: r.exifGpsOk,
    faceOk: r.faceOk,
    childMinorOk: r.childMinorOk,
    nameplatePlateOk: r.nameplatePlateOk,
    privateLifeOk: r.privateLifeOk,
    landmarkLevelOk: r.landmarkLevelOk,
  };
}

export async function getPostForEdit(id: number): Promise<EditorData | null> {
  const db = getDb();
  const post = await db.select().from(t.posts).where(eq(t.posts.id, id)).get();
  if (!post) return null;

  const [themeRows, tagRows, mediaRows, checklist] = await Promise.all([
    db.select().from(t.postThemes).where(eq(t.postThemes.postId, id)),
    db.select().from(t.postTags).where(eq(t.postTags.postId, id)),
    db.select().from(t.media).where(eq(t.media.postId, id)).orderBy(t.media.ord),
    db.select().from(t.publishChecklists).where(eq(t.publishChecklists.postId, id)).get(),
  ]);

  const mediaIds = mediaRows.map((m) => m.id);
  const reviews = mediaIds.length
    ? await db.select().from(t.safetyReviews).where(inArray(t.safetyReviews.mediaId, mediaIds))
    : [];
  const reviewByMedia = new Map(reviews.map((r) => [r.mediaId, r]));

  return {
    post,
    themeSlugs: themeRows.map((r) => r.themeSlug),
    tagIds: tagRows.map((r) => r.tagId),
    media: mediaRows.map((m) => ({
      id: m.id,
      filename: m.filename,
      publicUrl: m.publicUrl,
      ord: m.ord,
      alt: m.alt,
      review: reviewByMedia.has(m.id) ? toReviewState(reviewByMedia.get(m.id)!) : null,
      ogpOk: reviewByMedia.get(m.id)?.ogpOk ?? false,
    })),
    checklist: checklist ?? null,
  };
}

/* ── 更新系 ── */

export async function createDraft(input: { slug: string; title?: string }): Promise<number> {
  const db = getDb();
  const row = await db
    .insert(t.posts)
    .values({ slug: input.slug, title: input.title ?? null, status: "draft" })
    .returning({ id: t.posts.id })
    .get();
  return row.id;
}

export type PostFields = {
  title: string | null;
  body: string | null;
  mode: "light" | "standard";
  seasonSlug: string | null;
  timeOfDay: "morning" | "noon" | "evening" | "night" | null;
  placeId: number | null;
  mapDisplay: boolean | null;
  locationLevelOverride: "A" | "B" | "C" | "D" | null;
  shootingDate: string | null;
};

export async function updatePostFields(id: number, f: PostFields): Promise<void> {
  const db = getDb();
  await db.update(t.posts).set(f).where(eq(t.posts.id, id));
}

export async function setPostThemes(id: number, slugs: string[]): Promise<void> {
  const db = getDb();
  await db.delete(t.postThemes).where(eq(t.postThemes.postId, id));
  if (slugs.length) {
    await db.insert(t.postThemes).values(slugs.map((themeSlug) => ({ postId: id, themeSlug })));
  }
}

export async function setPostTags(id: number, tagIds: number[]): Promise<void> {
  const db = getDb();
  await db.delete(t.postTags).where(eq(t.postTags.postId, id));
  if (tagIds.length) {
    await db.insert(t.postTags).values(tagIds.map((tagId) => ({ postId: id, tagId })));
  }
}

/** パイプライン処理済みの派生を Media 行として登録し、SafetyReview を初期化する */
export async function addProcessedMedia(input: {
  postId: number;
  filename: string;
  originalRef: string;
  publicUrl: string;
  alt?: string;
  /** 自動検査が通っていれば true（exif_gps_ok の根拠） */
  exifGpsOk: boolean;
}): Promise<number> {
  const db = getDb();
  const maxOrd = await db
    .select({ ord: t.media.ord })
    .from(t.media)
    .where(eq(t.media.postId, input.postId))
    .orderBy(desc(t.media.ord))
    .get();
  const ord = (maxOrd?.ord ?? -1) + 1;

  const m = await db
    .insert(t.media)
    .values({
      postId: input.postId,
      filename: input.filename,
      originalRef: input.originalRef,
      publicUrl: input.publicUrl,
      ord,
      alt: input.alt ?? null,
    })
    .returning({ id: t.media.id })
    .get();

  // 自動検査結果のみ反映。人手項目は未確認のまま（公開ゲートで確認を要求）
  await db.insert(t.safetyReviews).values({ mediaId: m.id, exifGpsOk: input.exifGpsOk });
  return m.id;
}

export async function deleteMedia(mediaId: number): Promise<void> {
  const db = getDb();
  await db.delete(t.media).where(eq(t.media.id, mediaId)); // safety_reviews は cascade
}

export type SafetyReviewPatch = Partial<Omit<typeof t.safetyReviews.$inferInsert, "mediaId">>;

export async function updateSafetyReview(mediaId: number, patch: SafetyReviewPatch): Promise<void> {
  const db = getDb();
  await db.update(t.safetyReviews).set(patch).where(eq(t.safetyReviews.mediaId, mediaId));
}

export async function upsertChecklist(
  postId: number,
  patch: { mapDisplayOk?: "unreviewed" | "confirmed"; locationLevelOk?: "unreviewed" | "confirmed" },
): Promise<void> {
  const db = getDb();
  const existing = await db
    .select()
    .from(t.publishChecklists)
    .where(eq(t.publishChecklists.postId, postId))
    .get();
  if (existing) {
    await db.update(t.publishChecklists).set(patch).where(eq(t.publishChecklists.postId, postId));
  } else {
    await db.insert(t.publishChecklists).values({ postId, ...patch });
  }
}

/* ── 公開ゲート判定 ── */

export async function loadGateInput(postId: number): Promise<PublishGateInput | null> {
  const data = await getPostForEdit(postId);
  if (!data) return null;
  return {
    mode: data.post.mode,
    title: data.post.title,
    body: data.post.body,
    seasonSlug: data.post.seasonSlug,
    placeId: data.post.placeId,
    themeCount: data.themeSlugs.length,
    media: data.media.map((m) => ({ id: m.id, label: m.alt || m.filename, review: m.review })),
    checklist: data.checklist
      ? { mapDisplayOk: data.checklist.mapDisplayOk, locationLevelOk: data.checklist.locationLevelOk }
      : null,
  };
}

export async function evaluateGate(postId: number): Promise<PublishGateResult | null> {
  const input = await loadGateInput(postId);
  return input ? evaluatePublishGate(input) : null;
}

/**
 * 公開へ遷移。ゲート不成立なら公開せず reasons を返す。
 * media_safety_cleared も同時に確定して保存する。
 */
export async function publishPost(
  postId: number,
): Promise<{ ok: boolean; reasons: string[] }> {
  const input = await loadGateInput(postId);
  if (!input) return { ok: false, reasons: ["投稿が見つかりません"] };
  const result = evaluatePublishGate(input);

  const db = getDb();
  // 算出フラグを保存（監査可能に）
  await upsertChecklist(postId, {});
  await db
    .update(t.publishChecklists)
    .set({ mediaSafetyCleared: computeMediaSafetyCleared(input.media) })
    .where(eq(t.publishChecklists.postId, postId));

  if (!result.canPublish) return { ok: false, reasons: result.reasons };
  await db.update(t.posts).set({ status: "published" }).where(eq(t.posts.id, postId));
  return { ok: true, reasons: [] };
}

export async function unpublishPost(postId: number): Promise<void> {
  const db = getDb();
  await db.update(t.posts).set({ status: "draft" }).where(eq(t.posts.id, postId));
}

export async function findPostIdByTheme(themeSlug: string): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({ postId: t.postThemes.postId })
    .from(t.postThemes)
    .where(eq(t.postThemes.themeSlug, themeSlug));
  return rows.map((r) => r.postId);
}
