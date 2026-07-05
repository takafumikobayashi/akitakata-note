/**
 * データモデル（Drizzle / Cloudflare D1）
 * 設計の正: docs/12_data_model.md。内部コードは ASCII（ADR-0006）、表示名はUI側で日本語化。
 */
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

// 公開レベル A/B/C/D（08 §5-2, 12 §6）
const LOCATION_LEVELS = ["A", "B", "C", "D"] as const;
// 人手チェックの状態（12 §4-10 / §4-11）
const REVIEW = ["unreviewed", "confirmed"] as const;

/* ── クローズド語彙（Season / Theme）: slug は ADR-0006 の確定値 ── */

export const seasons = sqliteTable("seasons", {
  slug: text("slug").primaryKey(), // spring / summer / autumn / winter / all-year
  name: text("name").notNull(), // 春 / 夏 / 秋 / 冬 / 通年
  sortOrder: integer("sort_order").notNull().default(0),
});

export const themes = sqliteTable("themes", {
  slug: text("slug").primaryKey(), // nature / culture / daily / event / food / mobility
  name: text("name").notNull(), // 自然 / 文化 / 日常 / イベント / 食 / 移動・行き方
  sortOrder: integer("sort_order").notNull().default(0),
});

// タグは候補語彙。MVPでは一覧URLなし（14 §4）。category は 06 §7-5 の区分
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // 桜 / 神楽 / 温泉街 ...
  category: text("category"), // subject / food / culture / place / mobility 等
});

/* ── Place（12 §4-2）: 位置情報公開レベルは Place 側に基本値 ── */

export const places = sqliteTable(
  "places",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(), // ローマ字翻字（ADR-0006）
    name: text("name").notNull(),
    displayName: text("display_name"),
    lat: real("lat"),
    lng: real("lng"),
    baseLocationLevel: text("base_location_level", { enum: LOCATION_LEVELS })
      .notNull()
      .default("A"),
    mapDisplayDefault: integer("map_display_default", { mode: "boolean" })
      .notNull()
      .default(true),
    accessNote: text("access_note"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("places_slug_idx").on(t.slug)],
);

// 場所固有タグ（温泉街 等）= Place 属性（06 §7-6, 12 §4-2）
export const placeTags = sqliteTable(
  "place_tags",
  {
    placeId: integer("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.tagId] })],
);

/* ── Post（12 §4-1）: 軽量/通常は同一エンティティ、mode で吸収 ── */

export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title"),
    body: text("body"),
    mode: text("mode", { enum: ["light", "standard"] }) // 軽量 / 通常
      .notNull()
      .default("standard"),
    status: text("status", { enum: ["draft", "published"] }) // 下書き / 公開
      .notNull()
      .default("draft"),
    shootingDate: text("shooting_date"), // YYYY-MM-DD
    seasonSlug: text("season_slug").references(() => seasons.slug),
    timeOfDay: text("time_of_day", {
      enum: ["morning", "noon", "evening", "night"], // 朝 / 昼 / 夕 / 夜
    }),
    placeId: integer("place_id").references(() => places.id),
    // 地図表示・公開レベルは Place 既定を Post で上書き可（12 §6）
    mapDisplay: integer("map_display", { mode: "boolean" }),
    locationLevelOverride: text("location_level_override", {
      enum: LOCATION_LEVELS,
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index("posts_slug_idx").on(t.slug),
    index("posts_status_idx").on(t.status),
    index("posts_place_idx").on(t.placeId),
  ],
);

// Post N—N Theme（複数付与が常用: 06 §6-7）
export const postThemes = sqliteTable(
  "post_themes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    themeSlug: text("theme_slug")
      .notNull()
      .references(() => themes.slug),
  },
  (t) => [primaryKey({ columns: [t.postId, t.themeSlug] })],
);

// Post N—N Tag
export const postTags = sqliteTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

/* ── Media（12 §4-6）＋ SafetyReview（12 §4-10, 画像単位の安全確認） ── */

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(), // 原本ファイル名
    originalRef: text("original_ref"), // 非公開R2の原本キー（配信経路に出さない）
    publicUrl: text("public_url"), // 派生(EXIF除去済み)の配信URL
    ord: integer("ord").notNull().default(0),
    alt: text("alt"),
    caption: text("caption"),
    createdAt: createdAt(),
  },
  (t) => [index("media_post_idx").on(t.postId)],
);

export const safetyReviews = sqliteTable("safety_reviews", {
  mediaId: integer("media_id")
    .primaryKey()
    .references(() => media.id, { onDelete: "cascade" }),
  // EXIF/GPS除去は構造+自動検査で担保（08 §11-4）。人の操作項目ではない
  exifGpsOk: integer("exif_gps_ok", { mode: "boolean" }).notNull().default(false),
  // 顔: AI提示→人が確定（未確認/不要/確定）
  faceOk: text("face_ok", { enum: ["unreviewed", "not_needed", "confirmed"] })
    .notNull()
    .default("unreviewed"),
  childMinorOk: text("child_minor_ok", { enum: REVIEW }).notNull().default("unreviewed"),
  nameplatePlateOk: text("nameplate_plate_ok", { enum: REVIEW }).notNull().default("unreviewed"),
  privateLifeOk: text("private_life_ok", { enum: REVIEW }).notNull().default("unreviewed"),
  landmarkLevelOk: text("landmark_level_ok", { enum: REVIEW }).notNull().default("unreviewed"),
  ogpOk: integer("ogp_ok", { mode: "boolean" }).notNull().default(false),
});

/* ── Link（関連リンク・12 §4-7）: 公式情報への導線 ── */

export const links = sqliteTable(
  "links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label"),
    ord: integer("ord").notNull().default(0),
  },
  (t) => [index("links_post_idx").on(t.postId)],
);

/* ── AIUsage（12 §4-9, Post従属）: AIは補助・履歴を必ず残す ── */

export const aiUsages = sqliteTable("ai_usages", {
  postId: integer("post_id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  used: integer("used", { mode: "boolean" }).notNull().default(false),
  targets: text("targets"), // JSON配列文字列: title/description/summary/tag/other
  humanReviewLevel: text("human_review_level", { enum: ["A", "B", "C"] }), // A全面編集/B確認修正/Cほぼそのまま
});

/* ── PublishChecklist（12 §4-11, Post従属）: 公開ゲート ── */

export const publishChecklists = sqliteTable("publish_checklists", {
  postId: integer("post_id")
    .primaryKey()
    .references(() => posts.id, { onDelete: "cascade" }),
  // 全 media の SafetyReview 完了から算出（1枚でも未確認なら false）
  mediaSafetyCleared: integer("media_safety_cleared", { mode: "boolean" })
    .notNull()
    .default(false),
  mapDisplayOk: text("map_display_ok", { enum: REVIEW }).notNull().default("unreviewed"),
  locationLevelOk: text("location_level_ok", { enum: REVIEW }).notNull().default("unreviewed"),
});

/* ── StaticPage（12 §4-8）: About等。将来の言語別フィールド余地 ── */

export const staticPages = sqliteTable("static_pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  localeFields: text("locale_fields"), // JSON（将来の /en 等）
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
