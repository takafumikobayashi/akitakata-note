/**
 * 公開ゲート（12 §5-1 / §5-2 / §5-3）。Cloudflare非依存の純ロジック。
 *
 * status を「公開」にできるのは全条件を満たすときのみ。1項目でも未充足なら不可。
 * UI はこの reasons をそのまま「公開できない理由」として表示する。
 */

export type FaceState = "unreviewed" | "not_needed" | "confirmed";
export type ReviewState = "unreviewed" | "confirmed";

/** 画像単位の安全確認状態（SafetyReview §4-10）。exif_gps_ok は自動検査結果 */
export type SafetyReviewState = {
  exifGpsOk: boolean;
  faceOk: FaceState;
  childMinorOk: ReviewState;
  nameplatePlateOk: ReviewState;
  privateLifeOk: ReviewState;
  landmarkLevelOk: ReviewState;
};

/**
 * この画像が「安全確認済み」か（12 §4-10 補足）。
 * exif_gps_ok=true かつ face_ok が不要/確定 かつ 人手項目がすべて確認済。
 */
export function isMediaSafe(r: SafetyReviewState): boolean {
  return (
    r.exifGpsOk &&
    (r.faceOk === "not_needed" || r.faceOk === "confirmed") &&
    r.childMinorOk === "confirmed" &&
    r.nameplatePlateOk === "confirmed" &&
    r.privateLifeOk === "confirmed" &&
    r.landmarkLevelOk === "confirmed"
  );
}

export type PublishGateInput = {
  mode: "light" | "standard";
  title: string | null;
  body: string | null;
  seasonSlug: string | null;
  placeId: number | null;
  themeCount: number;
  /** 各 media と その SafetyReview（未作成なら null＝未確認扱い） */
  media: { id: number; label: string; review: SafetyReviewState | null }[];
  /** 投稿単位の確認（PublishChecklist §4-11） */
  checklist: { mapDisplayOk: ReviewState; locationLevelOk: ReviewState } | null;
};

export type PublishGateResult = {
  canPublish: boolean;
  reasons: string[];
  /** 全 media の SafetyReview から算出（PublishChecklist.media_safety_cleared に反映） */
  mediaSafetyCleared: boolean;
};

/** 全 media が安全確認済みか（media が1枚もなければ false） */
export function computeMediaSafetyCleared(
  media: PublishGateInput["media"],
): boolean {
  return media.length > 0 && media.every((m) => m.review !== null && isMediaSafe(m.review));
}

export function evaluatePublishGate(post: PublishGateInput): PublishGateResult {
  const reasons: string[] = [];

  // 共通の必須条件（§5-1）
  if (post.media.length === 0) reasons.push("画像が1枚もありません");
  if (post.placeId === null) reasons.push("場所（Place）が未設定です");
  if (!post.seasonSlug) reasons.push("季節が未設定です");
  if (post.themeCount === 0) reasons.push("テーマが1つも付いていません");

  // 画像単位の安全確認（§4-10 / §5-1）
  for (const m of post.media) {
    if (!m.review) {
      reasons.push(`「${m.label}」の安全確認が未実施です`);
      continue;
    }
    const r = m.review;
    if (!r.exifGpsOk) reasons.push(`「${m.label}」のEXIF/GPS除去が未確認です（自動検査）`);
    if (r.faceOk === "unreviewed") reasons.push(`「${m.label}」の人物写り込み確認が未実施です`);
    if (r.childMinorOk !== "confirmed") reasons.push(`「${m.label}」の子ども・少人数の確認が未済です`);
    if (r.nameplatePlateOk !== "confirmed") reasons.push(`「${m.label}」の表札・ナンバーの確認が未済です`);
    if (r.privateLifeOk !== "confirmed") reasons.push(`「${m.label}」の私有地・生活導線の確認が未済です`);
    if (r.landmarkLevelOk !== "confirmed") reasons.push(`「${m.label}」のランドマーク地点特定の確認が未済です`);
  }

  // 投稿単位の確認（§4-11 / §5-1）
  if (!post.checklist || post.checklist.mapDisplayOk !== "confirmed") {
    reasons.push("地図表示の妥当性（map_display_ok）が未確認です");
  }
  if (!post.checklist || post.checklist.locationLevelOk !== "confirmed") {
    reasons.push("公開レベルの妥当性（location_level_ok）が未確認です");
  }

  // mode 別の本文条件（§5-2 通常 / §5-3 軽量緩和）
  if (!post.title || post.title.trim() === "") {
    reasons.push("タイトルが未入力です");
  }
  if (post.mode === "standard" && (!post.body || post.body.trim() === "")) {
    reasons.push("本文が未入力です（通常投稿）");
  }

  return {
    canPublish: reasons.length === 0,
    reasons,
    mediaSafetyCleared: computeMediaSafetyCleared(post.media),
  };
}
