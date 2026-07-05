/**
 * 画像パイプライン（ADR-0003）。
 *
 * 流れ:
 *  1) 原本を R2 非公開(ORIGINALS)へ隔離保存（EXIF/GPS 付きのまま、配信経路に出さない）。
 *  2) 原本から EXIF を読み、撮影日を取り出す（GPS は内部記録のみ・戻り値でも公開面に渡さない）。
 *  3) Image Transformations で各サイズ WebP に再エンコード（metadata:"none"）＝メタデータを構造的に除去。
 *  4) 自動検査: 各派生に EXIF が残っていないことをアサート（多層防御・公開ゲートの独立保証層）。
 *  5) 検査を通った派生のみ R2 公開(DERIVATIVES)へ保存し、public_url を確定。
 *
 * 1枚でも自動検査に落ちたら例外を投げ、公開派生は作らない（12 §5-1 の公開ゲートに接続）。
 */
import { exifDateToIso, parseJpegExif, scanForExif } from "./exif";

export type ImagePipelineEnv = {
  ORIGINALS: R2Bucket;
  DERIVATIVES: R2Bucket;
  IMAGES: ImagesBinding;
  /** 派生の公開ベースURL（R2カスタムドメイン等）。未設定なら /media 経由で配信 */
  DERIVATIVES_PUBLIC_BASE?: string;
};

/** 生成する派生（レスポンシブ幅）。写真主役・スマホ最優先の想定幅 */
export type DerivativeSpec = { label: string; width: number; format: "image/webp" | "image/avif" };

export const DEFAULT_DERIVATIVES: DerivativeSpec[] = [
  { label: "w640", width: 640, format: "image/webp" },
  { label: "w1280", width: 1280, format: "image/webp" },
  { label: "w1920", width: 1920, format: "image/webp" },
];

export class AutoCheckError extends Error {
  constructor(
    readonly key: string,
    readonly markers: string[],
  ) {
    super(`公開派生に EXIF が残存: ${key} (${markers.join(", ")})`);
    this.name = "AutoCheckError";
  }
}

export type DerivativeResult = { label: string; width: number; key: string; publicUrl: string };

export type ProcessResult = {
  /** 非公開R2の原本キー（Media.original_ref） */
  originalRef: string;
  /** 撮影日 YYYY-MM-DD（あれば。季節仮判定の材料 06 §5-4） */
  shootingDate?: string;
  /** 原本のGPS有無（内部記録のみ。公開面へは出さない） */
  originalHadGps: boolean;
  /** 公開派生。最大幅を Media.public_url の既定に使う想定 */
  derivatives: DerivativeResult[];
  /** 全派生が自動検査を通過（SafetyReview.exif_gps_ok の根拠） */
  exifGpsOk: true;
};

function extKey(base: string, label: string, format: string): string {
  const ext = format === "image/avif" ? "avif" : "webp";
  return `derivatives/${base}/${label}.${ext}`;
}

export function mediaPublicUrl(env: ImagePipelineEnv, key: string): string {
  const base = env.DERIVATIVES_PUBLIC_BASE?.replace(/\/$/, "");
  // key は "derivatives/..." 。公開ベース未設定時は /media ルート配信にフォールバック
  return base ? `${base}/${key}` : `/media/${key}`;
}

/** Image Transformations で再エンコード（metadata:"none"）し、派生バイト列を返す */
async function reencode(
  env: ImagePipelineEnv,
  original: Uint8Array,
  spec: DerivativeSpec,
): Promise<Uint8Array> {
  const stream = new Blob([original as BlobPart]).stream();
  const result = await env.IMAGES.input(stream)
    // metadata:"none" で可視/不可視メタデータを破棄（既定 copyright でもGPSは落ちるが明示する）
    .transform({ width: spec.width, metadata: "none" } as ImageTransform)
    .output({ format: spec.format });
  const bytes = await result.response().arrayBuffer();
  return new Uint8Array(bytes);
}

/**
 * 1枚のアップロードを処理する。id は Media 行の識別子（未採番なら crypto.randomUUID()）。
 * 例外: 自動検査に落ちた場合 AutoCheckError（公開派生は保存しない）。
 */
export async function processUpload(
  env: ImagePipelineEnv,
  input: {
    id: string;
    filename: string;
    bytes: Uint8Array;
    contentType?: string;
    derivatives?: DerivativeSpec[];
  },
): Promise<ProcessResult> {
  const { id, filename, bytes } = input;
  const specs = input.derivatives ?? DEFAULT_DERIVATIVES;

  // 1) 原本を非公開R2へ隔離
  const originalRef = `originals/${id}/${filename}`;
  await env.ORIGINALS.put(originalRef, bytes as ArrayBufferView<ArrayBuffer>, {
    httpMetadata: input.contentType ? { contentType: input.contentType } : undefined,
  });

  // 2) EXIF 読み取り（撮影日→公開可 / GPS→内部のみ）
  const exif = parseJpegExif(bytes);
  const shootingDate = exifDateToIso(exif.dateTimeOriginal);

  // 3-5) 派生生成 → 自動検査 → 通過分のみ公開R2へ
  const derivatives: DerivativeResult[] = [];
  for (const spec of specs) {
    const derived = await reencode(env, bytes, spec);

    // 4) 自動検査: 残存EXIFが無いこと（多層防御）
    const scan = scanForExif(derived);
    if (scan.hasExif) {
      throw new AutoCheckError(extKey(id, spec.label, spec.format), scan.markers);
    }

    // 5) 公開R2へ保存
    const key = extKey(id, spec.label, spec.format);
    await env.DERIVATIVES.put(key, derived as ArrayBufferView<ArrayBuffer>, {
      httpMetadata: { contentType: spec.format },
    });
    derivatives.push({ label: spec.label, width: spec.width, key, publicUrl: mediaPublicUrl(env, key) });
  }

  return {
    originalRef,
    shootingDate,
    originalHadGps: exif.hasGps,
    derivatives,
    exifGpsOk: true,
  };
}

/**
 * 定期／配信前の再検査。公開R2の1派生が EXIF を含まないことをアサート。
 * 残存検出時は false を返す（呼び出し側で公開ゲートを閉じる 12 §5-1）。
 */
export async function recheckDerivative(env: ImagePipelineEnv, key: string): Promise<boolean> {
  const obj = await env.DERIVATIVES.get(key);
  if (!obj) return false;
  const bytes = new Uint8Array(await obj.arrayBuffer());
  return !scanForExif(bytes).hasExif;
}
