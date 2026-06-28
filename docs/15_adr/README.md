# 技術選定メモ（ADR）

本ディレクトリは、ロードマップ Step 9（`../10_how_to_proceed_roadmap.md`）に対応する技術選定の意思決定記録（Architecture Decision Record）を置く。
個人運営での継続性・実現可能性を重視し、抽象論で終わらせず候補比較と採否をここで確定する（`../10 §2-3`）。

採番について: ロードマップ上は「14_adr/」と記載されていたが、情報設計書が `14_information_architecture.md` を使用したため、ADR は `15_adr/` に置く。

## ADR の書式

各 ADR は以下を含む（`../10` Step 9 の「決めること」に対応）。

* ステータス: 提案中（Proposed）/ 採用（Accepted）/ 見送り（Rejected）/ 置換（Superseded by ...）
* 背景・要件（Context）
* 候補
* 比較観点
* 決定（採用と採用理由）
* 見送り理由
* 影響（関連文書・後続ADR）
* 将来見直す条件

## 一覧と優先順位

| # | テーマ | ファイル | ステータス |
|---|---|---|---|
| 0001 | フロントエンド基盤 | `0001-frontend-framework.md` | 採用（Next.js App Router ＋ Cloudflare/R2） |
| 0002 | コンテンツ管理方式（CMS） | `0002-content-management.md` | 採用（フルカスタム: Drizzle ＋ D1 ＋ R2） |
| 0003 | 画像管理 / 配信 / EXIF除去 | `0003-image-pipeline.md` | 採用（R2二層 ＋ Image Transformations ＋ 自動検査） |
| 0004 | 地図基盤 | `0004-map-platform.md` | 採用（MapLibre GL JS ＋ Protomaps/PMTiles on R2） |
| 0005 | AI補助 API | `0005-ai-api.md` | 採用（Claude API。既定 Haiku 4.5 / 品質重視 Opus 4.8） |
| 0006 | 限定的 i18n / slug 表記 | `0006-i18n-slug.md` | 採用（コンテンツ日本語のみ・ASCII slug） |

**Step 9 の主要技術選定は 0001〜0006 ですべて確定済み（2026-06-28）。**

確定スタック要約: Next.js App Router ＋ Cloudflare（Workers/Pages）＋ D1 ＋ R2、フルカスタム（Drizzle ＋ 自作管理UI）、画像は R2二層＋Image Transformations＋EXIF自動検査、地図は MapLibre＋PMTiles on R2、AIは Claude API（Haiku 4.5 既定）、i18n は next-intl（固定ページのみ将来英語）・slug は ASCII。
