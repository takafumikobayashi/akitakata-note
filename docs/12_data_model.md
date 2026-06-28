# データ設計書

## 1. 文書の目的

本書は、「あきたかたノート」のデータモデルを定義する。
ロードマップ Step 7（`10_how_to_proceed_roadmap.md`）に対応し、CMS選定・実装時のデータ前提を明確にすることを目的とする。

本書の内容は机上案ではなく、仮投稿20本（`trial-posts/`、2026-05実施）の実データと、その検証結果（`06_taxonomy_design.md §9-4`）を土台にしている。
仮投稿は Notion 上でフラットな1テーブル（22カラム）として運用したが、本書ではそれを正規化し、再発見性・地図導線・安全配慮に耐える構造へ整理する。

参照する確定事項

* エンティティの大枠: `04_technical_overview.md §5-4`
* 分類語彙（季節・テーマ・タグ）: `06_taxonomy_design.md`
* 位置情報公開レベル: `08_photo_location_policy.md §5-2`、`06_taxonomy_design.md §4-4`
* AI補助履歴: `09_risk_ai_policy.md §5-2`
* 公開前チェック: `08_photo_location_policy.md §10`、`11_content_operations.md §7-3`

⸻

## 2. 設計方針

### 2-1. Post と Place を分離する

仮投稿では `場所名 / 緯度経度 / 公開レベル / 地図掲載 / 行き方` を投稿行にベタ書きしていたが、同じ場所が複数投稿に登場した（神楽門前湯治村4本、清神社2本、郡山城跡2本、吉田町吉田3本）。
これらを投稿ごとに重複保持すると、座標・公開レベル・行き方の管理が不安定になる。
そのため、場所情報は **Place** として独立させ、Post から参照する（`06_taxonomy_design.md §4-2` と整合）。

### 2-2. 分類は3層 + 場所で持つ

季節・テーマ・タグは役割が異なるため別フィールドで持つ（`06_taxonomy_design.md §2-3`）。

* 季節（Season）: 単一選択・クローズド語彙
* テーマ（Theme）: 複数選択・クローズド語彙
* タグ（Tag）: 複数選択・候補語彙（自由入力にはしない）

### 2-3. 軽量投稿と通常投稿は同一エンティティで持つ

`mode`（軽量 / 通常）を Post の属性として持ち、エンティティは分けない（`04_technical_overview.md §5-4`）。
必須項目の差は「公開条件」（§5）で吸収する。

### 2-4. 安全に関わる項目はデータ構造で守る

位置情報公開レベルと公開前チェックは任意メモではなく構造化フィールドとして持ち、公開条件に組み込む（`08_photo_location_policy.md`）。

### 2-5. 将来の英語対応・再ホストの余地を残す

固定文言・メタ情報は将来の言語別フィールド追加を妨げない構造とする（`04_technical_overview.md §5-4`）。
画像は Notion API の画像URLが1時間で期限切れする仕様があるため、本番移行時に再ホスト（Cloudflare R2 / Cloudinary 等）する前提を Media に持たせる。

⸻

## 3. エンティティ一覧

| エンティティ | 役割 | 仮投稿テーブルでの対応 |
|---|---|---|
| Post | 投稿本体 | 行そのもの（本文・タイトル・時期・mode・status等） |
| Place | 場所 | 場所名・緯度経度・公開レベル・地図掲載・行き方 |
| Season | 季節（クローズド） | 季節 |
| Theme | テーマ（クローズド・複数） | テーマ |
| Tag | タグ（候補語彙・複数） | タグ候補 |
| Media | 画像 | 写真 |
| Link | 関連リンク | 関連リンク |
| StaticPage | 固定ページ | （仮投稿に対応なし。About等） |

安全・公開ゲートに関わる構造（Post / Media 従属）

| 構造 | 単位 | 役割 |
|---|---|---|
| SafetyReview | Media（画像ごと） | 画像単位の安全確認状態（EXIF/GPS・人物・表札/ナンバー・私有地・ランドマーク・OGP適性） |
| PublishChecklist | Post（投稿ごと） | 公開ゲート。全 media の SafetyReview 完了 ＋ 投稿単位の確認（地図表示・公開レベル）を集約 |

関係性

* Post N — 1 Place（1投稿は1つの主たる場所を参照）
* Post N — 1 Season
* Post N — N Theme
* Post N — N Tag
* Post 1 — N Media
* Post N — N Link
* Place 1 — N Post（同じ場所に複数投稿が紐づく）
* Media 1 — 1 SafetyReview（画像ごとの安全確認）
* Post 1 — 1 PublishChecklist（投稿ごとの公開ゲート）

⸻

## 4. エンティティ定義

### 4-1. Post（投稿）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| post_id | string | ◯ | 内部識別子。仮投稿では trial-XXX |
| slug | string | ◯ | 公開URL用の可読スラッグ（`/posts/{slug}`）。タイトル or 場所＋要約ベース。自動IDのみは避ける。表示名と分離し、表示名変更後もURLを保てるようにする（`07 §9-2`、`14 §4`） |
| title | string | △ | タイトル / 一言メモ。軽量は一言メモ可、通常はタイトル必須 |
| body | text | △ | 本文 / メモ。軽量は数行可 |
| mode | enum(軽量, 通常) | ◯ | 投稿モード |
| status | enum(下書き, 公開) | ◯ | 公開状態 |
| shooting_date | date | △ | 撮影日 |
| season | ref(Season) | ◯ | 季節（単一） |
| time_of_day | enum(朝, 昼, 夕, 夜) | 任意 | 時間帯 |
| place | ref(Place) | ◯ | 主たる場所 |
| themes | ref(Theme)[] | ◯ | テーマ（1〜2個運用、複数可） |
| tags | ref(Tag)[] | 任意 | タグ候補 |
| media | ref(Media)[] | ◯ | 写真（1枚以上） |
| links | ref(Link)[] | 任意 | 関連リンク |
| map_display | bool | ◯ | 地図掲載可否（Place基本値を上書き可、§4-2参照） |
| location_level_override | enum(A,B,C,D) | 任意 | 公開レベルの投稿単位上書き（未指定なら Place の基本値） |
| publish_checklist | ref(PublishChecklist) | ◯ | 公開ゲート（§4-11）。単一フラグではない |
| ai_usage | ref(AIUsage) | ◯ | AI補助履歴（§4-9） |
| created_at | datetime | ◯ | 作成日時 |

補足

* `season` は撮影日から機械的に仮判定し、人が修正する（`06_taxonomy_design.md §5-4`）。
* `time_of_day` は季節とは別軸。タグの `夕景` 等とは役割が異なる（時間帯＝事実、タグ＝景の特徴）。
* `map_display` と `location_level_override` は Place の基本値を尊重しつつ、Post 文脈で安全側に倒せるようにする（§4-2 / §6）。

### 4-2. Place（場所）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| place_id | string | ◯ | 内部識別子 |
| slug | string | ◯ | 公開URL用の可読スラッグ（`/place/{slug}`）。場所名ベース。表示名と分離（`07 §9`、`14 §4`） |
| name | string | ◯ | 場所名（例: 神楽門前湯治村） |
| display_name | string | 任意 | 表示用名称 |
| latlng | geo | 任意 | 緯度経度または代表地点 |
| base_location_level | enum(A,B,C,D) | ◯ | 位置情報公開レベルの基本値（Place側に持つ） |
| map_display_default | bool | ◯ | 地図掲載の既定値 |
| access_note | text | 任意 | 行き方 |
| note | text | 任意 | 補足説明 |
| place_tags | ref(Tag)[] | 任意 | 場所固有タグ（例: 温泉街）。§7-6に基づき Post ではなく Place に持つ |

補足

* 位置情報公開レベルは Place 側に基本値を持ち、最終判断は Post 文脈で行う（`06_taxonomy_design.md §4-4`、`08_photo_location_policy.md §5-2`）。
* `place_tags` は「その場所に必ず付くタグ」を Post 側で毎回付与しないための受け皿（`06_taxonomy_design.md §7-6`）。

### 4-3. Season（季節）

クローズド語彙。単一選択。

* 値: 春 / 夏 / 秋 / 冬 / 通年（`06_taxonomy_design.md §5-2`）
* 仮投稿では 春 / 冬 / 通年 が出現。四季＋通年で不足なし
* 各値は公開URL用の安定 slug を持つ（`/season/{slug}`、`14 §4`）。slug は表示名と分離する。**slug は ADR-0006 で確定**: 春=`spring` / 夏=`summer` / 秋=`autumn` / 冬=`winter` / 通年=`all-year`。

### 4-4. Theme（テーマ）

運営者管理のクローズド語彙。複数選択可。

* 値: 自然 / 文化 / 日常 / イベント / 食 / 移動・行き方（`06_taxonomy_design.md §6-3`）
* 仮投稿で初期6種に過不足なし。複数付与が常用されたため複数選択を正式採用（`06_taxonomy_design.md §6-7`）
* 新規追加・統合は再分類前提（`06_taxonomy_design.md §8-4`）
* 各値は公開URL用の安定 slug を持つ（`/theme/{slug}`、`14 §4`）。slug は表示名と分離する。**slug は ADR-0006 で確定**: 自然=`nature` / 文化=`culture` / 日常=`daily` / イベント=`event` / 食=`food` / 移動・行き方=`mobility`。記号・複合語の%エンコードを避けるため英語 slug を採用。

### 4-5. Tag（タグ）

候補語彙。完全自由入力にはせず、運営者が候補を育てる（`06_taxonomy_design.md §7-2`）。複数選択可。

初期統制語彙（`06_taxonomy_design.md §7-5`、仮投稿20本で確定）

* 被写体・風景: 桜 / 城跡 / 神社 / ダム湖 / 古建築 / 廃校 / 動物 / 朝もや / 夕景 / 展望 / まちなみ
* 食ジャンル: お好み焼き / ラーメン / うどん / サンドイッチ / 道の駅グルメ
* 文化・歴史: 神楽 / 夜神楽 / 毛利氏 / 歴史 / パワースポット / 花占い / アート / 祭り
* 場・施設: 道の駅 / 温泉街 / 駅 / 産直
* 移動: 芸備線

慎重タグ（子連れ・駐車場あり等の断定）は持たない（`06_taxonomy_design.md §7-3`）。

### 4-6. Media（画像）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| media_id | string | ◯ | 識別子 |
| filename | string | ◯ | 原本ファイル名（仮投稿では IMG_XXXX.jpg） |
| original_ref | string | 任意 | 原本の保管先（非公開ストレージ。配信経路には載せない） |
| public_url | string | 任意 | 配信URL。再エンコード済みの派生画像のみを指す |
| order | int | ◯ | 表示順 |
| alt | string | 任意 | 代替テキスト（将来の言語別フィールド余地） |
| caption | string | 任意 | キャプション |
| safety_review | ref(SafetyReview) | ◯ | 画像単位の安全確認（§4-10） |

補足

* Notion API 経由の画像URLは1時間で期限切れするため、本番移行時に再ホストし `public_url` を張り替える（`04_technical_overview.md §5-5`）。
* **EXIF/GPS除去はフィールドの手動入力ではなく構造で担保する**（`08 §11-4`）。`public_url` は原本ではなく再エンコードした派生画像のみを指し、原本は `original_ref`（非公開）に隔離する。
* 画像の安全状態（EXIF/GPS除去・人物・私有情報・OGP適性）は Media に直接持たず、SafetyReview（§4-10）に分離する。これにより公開ゲート（PublishChecklist §4-11）が画像単位の確認を集約できる。

### 4-7. Link（関連リンク）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| link_id | string | ◯ | 識別子 |
| url | string | ◯ | URL |
| label | string | 任意 | 表示ラベル |

補足

* 公式情報への導線（市公式・施設公式・食べログ等）に用いる。公開前チェックの「公式情報への導線」と対応（`08_photo_location_policy.md §10`）。

### 4-8. StaticPage（固定ページ）

About・運営方針・利用上の注意等。仮投稿に対応データはない。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| slug | string | ◯ | URL slug |
| title | string | ◯ | タイトル |
| body | text | ◯ | 本文 |
| locale_fields | object | 任意 | 将来の言語別フィールド余地（`04_technical_overview.md §5-4`） |

### 4-9. AIUsage（AI補助履歴・Post従属）

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| used | bool | ◯ | AI使用の有無 |
| targets | enum[]（タイトル / 説明文 / 要約 / タグ / その他） | 任意 | 使用対象 |
| human_review_level | enum(A, B, C) | ◯ | 人の関与度。A:全面編集 / B:確認修正 / C:ほぼそのまま（`09_risk_ai_policy.md §5-2`） |

補足

* 仮投稿では trial-001〜006 と trial-008〜010 が AI使用（計9件、対象＝説明文 / その他）、trial-007 と trial-011〜020 が不使用（計11件）。AIの代弁者化を避けるため履歴を必ず残す（`02_design_principles.md` のトーン方針）。

### 4-10. SafetyReview（画像単位の安全確認・Media従属）

画像ごとの安全確認状態を持つ。Media に直接フラグを散らさず、ここに集約する（`08 §10-2 / §11`）。

| フィールド | 型 | 必須 | 担保方法 | 説明 |
|---|---|---|---|---|
| exif_gps_ok | bool | ◯ | 構造＋自動検査 | 派生画像がEXIF/GPS除去済み。CI/定期スキャン結果を反映（`08 §11-4`）。人の確認項目ではない |
| face_ok | enum(未確認, 不要, 確定) | ◯ | AI提示＋人 | 人物写り込み。AIは候補提示のみ、確定は人（`08 §11-5`）。自動で「確定」にしない |
| child_minor_ok | enum(未確認, 確認済) | ◯ | 人 | 子ども・少人数参加者の特定可否（`08 §6-4`） |
| nameplate_plate_ok | enum(未確認, 確認済) | ◯ | 人 | 表札・ナンバー・住宅入口（`08 §7-2`） |
| private_life_ok | enum(未確認, 確認済) | ◯ | 人 | 私有地・生活導線の露出（`08 §7`） |
| landmark_level_ok | enum(未確認, 確認済) | ◯ | 人 | 画像内ランドマークで公開レベルより狭く地点特定されないか（`08 §5-2`） |
| ogp_ok | bool | 任意 | 人 | OGP/サムネイル用途として可か（`08 §9`） |

* この画像が「安全確認済み」とみなせるのは、exif_gps_ok=true かつ face_ok が「不要/確定」かつ 人手項目がすべて「確認済」のとき。
* この粒度がそのまま MVP の公開前チェックUIのチェックリスト項目になる（情報設計書 Step 8 へ引き継ぐ）。

### 4-11. PublishChecklist（公開ゲート・Post従属）

投稿単位で公開可否を集約する。`status = 公開` への遷移はこのチェックリスト通過を前提にする。

| フィールド | 型 | 必須 | 担保方法 | 説明 |
|---|---|---|---|---|
| media_safety_cleared | bool | ◯ | 派生（全mediaのSafetyReviewから算出） | 全 media の SafetyReview が安全確認済みか |
| map_display_ok | enum(未確認, 確認済) | ◯ | 人 | 地図上の位置表示が適切か（`08 §5-4`） |
| location_level_ok | enum(未確認, 確認済) | ◯ | 人 | 投稿の公開レベル（Place基本値/override）が妥当か |

* 全項目が満たされ（media_safety_cleared=true、人手項目が「確認済」）なければ status を「公開」にできない（§5-1 の公開ゲート）。
* SafetyReview が画像単位、PublishChecklist が投稿単位という二層にすることで、複数画像のうち1枚でも未確認なら投稿全体を公開不可にできる。

⸻

## 5. 公開条件

`status = 公開` にできる条件を mode 別に定める。下書きは制約なし。

### 5-1. 共通の必須条件（軽量・通常とも）

* media が1枚以上ある
* place が設定され、`base_location_level`（または override）が確定している
* season が設定されている
* themes が1個以上ある
* **全 media の SafetyReview（§4-10）が安全確認済み**（exif_gps_ok=true、face_ok が不要/確定、人手項目がすべて確認済。1枚でも未確認なら公開不可。`08 §11-4 / §11-5`）
* **PublishChecklist（§4-11）の全項目が通過している**（media_safety_cleared=true、map_display_ok・location_level_ok が確認済）

これらは公開ゲートであり、1項目でも未充足なら status を「公開」にできない。
EXIF除去は手入力フラグではなく構造と自動検査で担保する（§4-6 補足）。

### 5-2. 通常投稿の追加条件

* title が設定されている
* body が本文として整形されている

### 5-3. 軽量投稿の緩和

* title は一言メモで可
* body は数行メモで可
* tags / links / time_of_day は任意

### 5-4. 公開前チェックの構造（二層）

仮投稿テーブルでは公開前チェックが単一の Yes/No フラグだったが、どの観点を確認したのかが残らず、MVPの公開前チェックUIに落とせない。
そのため単一フラグではなく、**画像単位（SafetyReview §4-10）と投稿単位（PublishChecklist §4-11）の二層**で持つ（`08 §10-2 / §11-6`）。

* 安全確認の大半（EXIF/GPS・人物・表札/ナンバー・私有地・ランドマーク・OGP適性）は**画像ごとの属性**であり SafetyReview に持つ。複数画像のうち1枚でも未確認なら投稿は公開できない。
* 地図表示・公開レベルの妥当性は**投稿単位**の判断であり PublishChecklist に持つ。
* この二層がそのまま MVP の公開前チェックUIのチェックリスト項目になる（情報設計書 Step 8 へ引き継ぐ）。

仮投稿（2026-06-28時点）の実データでは、公開15本すべてが公開前チェック完了（Yes）、下書き5本のうち 016/017 が完了（Yes）・018/019/020 が未完了（No）だった。公開済みに未完了は無く、`§5-1` の公開ゲートと整合している。移行時はこの単一フラグを二層構造（SafetyReview / PublishChecklist）へ展開する。

⸻

## 6. 位置情報公開レベルの持ち方

* 基本値は Place（`base_location_level`）に持つ。
* Post 単位で安全側へ落とす場合のみ `location_level_override` で上書きする。
* 地図表示（`map_display`）も同様に Place 既定値を Post で上書き可能とする。
* レベル定義（`08_photo_location_policy.md §5-2`）
  * A: 正確な代表地点を出してよい
  * B: おおよその地域表示に留める
  * C: 地名・地区名のみ
  * D: 地図非表示 / 非公開

仮投稿実績: A17 / B2 / C1。
Bレベル（002, 007＝吉田町吉田）は latlng を保持しつつ本文で地点をぼかし、関連リンクを付けない運用だった。
この「座標は持つが公開表現は抑える」挙動は、レベルをデータで持ち表示側で制御する設計で実現する。
ただし写真安全確認（`08_photo_location_policy.md`、`trial-posts/photo_safety_check.md`）では、002/007 の画像内にチェーン店・銀行の看板が写り、レベルの意図を超えて地点が特定可能だった。レベルは画像内容にも適用する（`08 §5-2`）。

⸻

## 7. 仮投稿テーブル（22カラム）との対応表

| 仮投稿カラム | 反映先 |
|---|---|
| post_id | Post.post_id |
| タイトル_メモ | Post.title |
| 本文_メモ | Post.body |
| mode | Post.mode |
| status | Post.status |
| 撮影日 | Post.shooting_date |
| 季節 | Post.season → Season |
| 時間帯 | Post.time_of_day |
| テーマ | Post.themes → Theme |
| タグ候補 | Post.tags → Tag |
| 写真 | Post.media → Media.filename |
| 関連リンク | Post.links → Link |
| 場所名 | Place.name |
| 緯度経度 | Place.latlng |
| 公開レベル | Place.base_location_level（/ Post.location_level_override） |
| 地図掲載 | Place.map_display_default（/ Post.map_display） |
| 行き方 | Place.access_note |
| AI使用 | AIUsage.used |
| AI使用対象 | AIUsage.targets |
| 公開前チェック完了 | PublishChecklist（§4-11）＋ 各 media の SafetyReview（§4-10）。単一フラグ → 二層構造へ展開 |
| 写真（安全状態） | Media.safety_review → SafetyReview（仮投稿テーブルに対応列なし。移行時に付与・自動検査） |
| created_at | Post.created_at |
| 仮投稿の気づき | （移行対象外。仮投稿フェーズのみのメモ） |

⸻

## 8. 残課題・後続への引き継ぎ

* `human_review_level`（AIのA/B/C）は仮投稿テーブルでは未取得。CMS移行時に付与ルールを決める。
* Place の同定（表記ゆれの名寄せ。例: 「吉田町吉田」エリア系投稿）の運用ルールは `11_content_operations.md` で詰める。
* タグの候補選択UI（自由入力を許さない入力体験）は情報設計書（Step 8）で扱う。
* slug の表記方針は **ADR-0006 で確定（ASCII基本）**: クローズド語彙（Theme/Season）は固定の英語 slug、Post/Place はローマ字翻字＋手動編集可。slug は内部識別子（post_id 等）および表示名と分離し、URL の安定性を保つ（§4-1 / §4-2 / §4-3 / §4-4）。Tag の URL（`/tag/...`）はMVPでは設けない（タグは表示のみ・一覧ページなし。`14 §4`）。将来タグページを設ける場合のみ同 slug 方針を適用する。
* StaticPage の言語別フィールドは限定的英語対応の検討時に具体化する。
* 画像配信パイプライン（原本隔離・派生再エンコード・EXIF自動検査・AI顔検出）の具体実装は本番スタック確定（Step 9 ADR）時に詰める。データモデル上の前提は §4-6 / §5 / §5-4 で固定済み。
* SafetyReview.exif_gps_ok を担保する自動検査（CI/定期スキャン）の配置先（CI・配信前フック・定期ジョブ）は技術スタック確定時に決める。`08 §11-4` 準拠。

⸻

## 9. 後続文書との関係

* `04_technical_overview.md §5-4`: エンティティ大枠の親文書
* `06_taxonomy_design.md`: Season / Theme / Tag / Place の語彙と運用ルール
* `08_photo_location_policy.md`: 位置情報公開レベル・公開前チェック
* `09_risk_ai_policy.md`: AI補助履歴の持ち方
* `14_information_architecture.md`（Step 8・作成済み）: 本データモデルを UI・導線・フィルタ・公開前チェックUIへ展開する
* `11_content_operations.md`: 入力・再分類・名寄せの運用ルール
