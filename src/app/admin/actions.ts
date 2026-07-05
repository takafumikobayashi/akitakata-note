"use server";

/**
 * 管理UIのサーバーアクション。すべて D1/R2/Images バインディング経由（Workers 実行時）。
 * 画像アップロードは ADR-0003 のパイプラインを起動し、通過分のみ Media 化する。
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  addProcessedMedia,
  createDraft,
  deleteMedia,
  publishPost,
  setPostTags,
  setPostThemes,
  unpublishPost,
  updatePostFields,
  updateSafetyReview,
  upsertChecklist,
  type PostFields,
} from "@/db/queries";
import { processUpload, type ImagePipelineEnv } from "@/lib/images/pipeline";
import { toAsciiSlug } from "@/lib/slug";

function str(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export async function createPostAction(formData: FormData): Promise<void> {
  const title = str(formData.get("title"));
  const slug = toAsciiSlug(title ?? "", "post");
  const id = await createDraft({ slug, title: title ?? undefined });
  redirect(`/admin/posts/${id}`);
}

export async function savePostAction(postId: number, formData: FormData): Promise<void> {
  const placeIdRaw = str(formData.get("placeId"));
  const fields: PostFields = {
    title: str(formData.get("title")),
    body: str(formData.get("body")),
    mode: (str(formData.get("mode")) as PostFields["mode"]) ?? "standard",
    seasonSlug: str(formData.get("seasonSlug")),
    timeOfDay: str(formData.get("timeOfDay")) as PostFields["timeOfDay"],
    placeId: placeIdRaw ? Number(placeIdRaw) : null,
    mapDisplay: formData.get("mapDisplay") === "on" ? true : false,
    locationLevelOverride: str(formData.get("locationLevelOverride")) as PostFields["locationLevelOverride"],
    shootingDate: str(formData.get("shootingDate")),
  };
  await updatePostFields(postId, fields);

  const themeSlugs = formData.getAll("themes").map(String);
  await setPostThemes(postId, themeSlugs);
  const tagIds = formData.getAll("tags").map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  await setPostTags(postId, tagIds);

  revalidatePath(`/admin/posts/${postId}`);
}

export async function uploadMediaAction(postId: number, formData: FormData): Promise<void> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const { env } = getCloudflareContext();
  const pipelineEnv = env as unknown as ImagePipelineEnv;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = crypto.randomUUID();

  // パイプライン: 原本隔離 → 派生生成 → 自動検査。落ちれば例外（Media化しない）
  const result = await processUpload(pipelineEnv, {
    id,
    filename: file.name,
    bytes,
    contentType: file.type,
  });

  const primary = result.derivatives.at(-1) ?? result.derivatives[0];
  await addProcessedMedia({
    postId,
    filename: file.name,
    originalRef: result.originalRef,
    publicUrl: primary.publicUrl,
    alt: str(formData.get("alt")) ?? undefined,
    exifGpsOk: result.exifGpsOk, // 自動検査通過（true）
  });

  revalidatePath(`/admin/posts/${postId}`);
}

export async function deleteMediaAction(postId: number, mediaId: number): Promise<void> {
  await deleteMedia(mediaId);
  revalidatePath(`/admin/posts/${postId}`);
}

export async function saveSafetyReviewAction(
  postId: number,
  mediaId: number,
  formData: FormData,
): Promise<void> {
  await updateSafetyReview(mediaId, {
    faceOk: str(formData.get("faceOk")) as "unreviewed" | "not_needed" | "confirmed",
    childMinorOk: str(formData.get("childMinorOk")) as "unreviewed" | "confirmed",
    nameplatePlateOk: str(formData.get("nameplatePlateOk")) as "unreviewed" | "confirmed",
    privateLifeOk: str(formData.get("privateLifeOk")) as "unreviewed" | "confirmed",
    landmarkLevelOk: str(formData.get("landmarkLevelOk")) as "unreviewed" | "confirmed",
    ogpOk: formData.get("ogpOk") === "on",
  });
  revalidatePath(`/admin/posts/${postId}`);
}

export async function saveChecklistAction(postId: number, formData: FormData): Promise<void> {
  await upsertChecklist(postId, {
    mapDisplayOk: str(formData.get("mapDisplayOk")) as "unreviewed" | "confirmed",
    locationLevelOk: str(formData.get("locationLevelOk")) as "unreviewed" | "confirmed",
  });
  revalidatePath(`/admin/posts/${postId}`);
}

export async function publishAction(postId: number): Promise<void> {
  await publishPost(postId); // ゲート不成立なら公開されない（画面側で理由を表示）
  revalidatePath(`/admin/posts/${postId}`);
}

export async function unpublishAction(postId: number): Promise<void> {
  await unpublishPost(postId);
  revalidatePath(`/admin/posts/${postId}`);
}
