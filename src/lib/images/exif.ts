/**
 * EXIF / GPS 読み取り・残存検査（Cloudflare 非依存の純ロジック）。
 *
 * 役割は2つ（ADR-0003 / 08 §11-4）:
 *  1) 原本(JPEG)から撮影日時・GPS を読む → 撮影日は季節仮判定の材料、GPSは内部記録のみ。
 *  2) 公開派生に EXIF/GPS が残っていないことを検査する（自動検査＝公開ゲートの独立保証層）。
 *
 * 派生の再エンコード自体でメタデータは除去されるが、それに頼らず本モジュールで
 * 「残っていないこと」を独立にアサートする（多層防御）。
 */

export type GpsCoord = { lat: number; lng: number };

export type JpegExif = {
  hasExif: boolean;
  hasGps: boolean;
  gps?: GpsCoord;
  /** DateTimeOriginal（無ければ DateTime）。"YYYY:MM:DD HH:MM:SS" 形式 */
  dateTimeOriginal?: string;
};

// TIFF タグ
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_GPS_LAT_REF = 0x0001;
const TAG_GPS_LAT = 0x0002;
const TAG_GPS_LNG_REF = 0x0003;
const TAG_GPS_LNG = 0x0004;

// TIFF 型 → バイト長
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

/** JPEG バイト列から APP1(Exif) TIFF ブロックの開始位置を返す（無ければ -1） */
function findExifTiffStart(b: Uint8Array): number {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return -1; // SOI
  let p = 2;
  while (p + 4 <= b.length) {
    if (b[p] !== 0xff) return -1; // マーカー境界崩れ
    const marker = b[p + 1];
    if (marker === 0xda || marker === 0xd9) return -1; // SOS/EOI: これ以降に APP1 は無い
    const len = (b[p + 2] << 8) | b[p + 3];
    if (len < 2) return -1;
    if (marker === 0xe1) {
      const s = p + 4;
      // "Exif\0\0"
      if (
        b[s] === 0x45 && b[s + 1] === 0x78 && b[s + 2] === 0x69 &&
        b[s + 3] === 0x66 && b[s + 4] === 0x00 && b[s + 5] === 0x00
      ) {
        return s + 6; // TIFF ヘッダ先頭
      }
    }
    p += 2 + len;
  }
  return -1;
}

type Ifd = { view: DataView; tiff: number; little: boolean };

function readEntries(
  ifd: Ifd,
  ifdOffset: number,
  visit: (tag: number, type: number, count: number, valueOffset: number) => void,
): number {
  const { view, tiff, little } = ifd;
  const base = tiff + ifdOffset;
  if (base + 2 > view.byteLength) return 0;
  const count = view.getUint16(base, little);
  let e = base + 2;
  for (let i = 0; i < count; i++, e += 12) {
    if (e + 12 > view.byteLength) break;
    const tag = view.getUint16(e, little);
    const type = view.getUint16(e + 2, little);
    const num = view.getUint32(e + 4, little);
    visit(tag, type, num, e + 8);
  }
  // 次IFDオフセット
  return e + 4 <= view.byteLength ? view.getUint32(e, little) : 0;
}

/** value/offset フィールドの実体オフセット（TIFF 先頭からの相対）を返す */
function resolveOffset(ifd: Ifd, type: number, count: number, valueField: number): number {
  const size = (TYPE_SIZE[type] ?? 1) * count;
  if (size <= 4) return valueField - ifd.tiff; // 4バイト以内はフィールドに直接格納
  return ifd.view.getUint32(valueField, ifd.little);
}

function readAscii(ifd: Ifd, off: number, count: number): string {
  const { view, tiff } = ifd;
  const start = tiff + off;
  let s = "";
  for (let i = 0; i < count && start + i < view.byteLength; i++) {
    const c = view.getUint8(start + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function readRationalTriplet(ifd: Ifd, off: number): [number, number, number] {
  const { view, tiff, little } = ifd;
  const r = (i: number) => {
    const p = tiff + off + i * 8;
    const n = view.getUint32(p, little);
    const d = view.getUint32(p + 4, little);
    return d === 0 ? 0 : n / d;
  };
  return [r(0), r(1), r(2)];
}

function dmsToDecimal([d, m, s]: [number, number, number], ref: string): number {
  const dec = d + m / 60 + s / 3600;
  return ref === "S" || ref === "W" ? -dec : dec;
}

/**
 * JPEG から EXIF（撮影日時・GPS）を読む。JPEG でない/EXIF 無しなら hasExif=false。
 * 例外は投げず、読めた範囲を返す（アップロード処理を止めない）。
 */
export function parseJpegExif(bytes: Uint8Array): JpegExif {
  const tiff = findExifTiffStart(bytes);
  if (tiff < 0) return { hasExif: false, hasGps: false };

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bom = view.getUint16(tiff, false);
  const little = bom === 0x4949; // "II"
  if (!little && bom !== 0x4d4d) return { hasExif: false, hasGps: false };
  const ifd: Ifd = { view, tiff, little };

  const result: JpegExif = { hasExif: true, hasGps: false };
  let exifIfdOffset = 0;
  let gpsIfdOffset = 0;
  let dateTime: string | undefined;

  readEntries(ifd, view.getUint32(tiff + 4, little), (tag, type, count, valueField) => {
    if (tag === TAG_EXIF_IFD) exifIfdOffset = view.getUint32(valueField, little);
    else if (tag === TAG_GPS_IFD) gpsIfdOffset = view.getUint32(valueField, little);
    else if (tag === TAG_DATETIME && type === 2) {
      dateTime = readAscii(ifd, resolveOffset(ifd, type, count, valueField), count);
    }
  });

  if (exifIfdOffset) {
    readEntries(ifd, exifIfdOffset, (tag, type, count, valueField) => {
      if (tag === TAG_DATETIME_ORIGINAL && type === 2) {
        result.dateTimeOriginal = readAscii(ifd, resolveOffset(ifd, type, count, valueField), count);
      }
    });
  }
  if (!result.dateTimeOriginal && dateTime) result.dateTimeOriginal = dateTime;

  if (gpsIfdOffset) {
    let latRef = "N";
    let lngRef = "E";
    let lat: [number, number, number] | undefined;
    let lng: [number, number, number] | undefined;
    readEntries(ifd, gpsIfdOffset, (tag, type, count, valueField) => {
      if (tag === TAG_GPS_LAT_REF) latRef = readAscii(ifd, resolveOffset(ifd, type, count, valueField), count);
      else if (tag === TAG_GPS_LNG_REF) lngRef = readAscii(ifd, resolveOffset(ifd, type, count, valueField), count);
      else if (tag === TAG_GPS_LAT) lat = readRationalTriplet(ifd, resolveOffset(ifd, type, count, valueField));
      else if (tag === TAG_GPS_LNG) lng = readRationalTriplet(ifd, resolveOffset(ifd, type, count, valueField));
    });
    if (lat && lng) {
      result.hasGps = true;
      result.gps = { lat: dmsToDecimal(lat, latRef), lng: dmsToDecimal(lng, lngRef) };
    } else {
      // GPS IFD は在るが座標未取得でも「GPS痕跡あり」として扱う（安全側）
      result.hasGps = true;
    }
  }

  return result;
}

/** "YYYY:MM:DD ..." を "YYYY-MM-DD" に。読めなければ undefined */
export function exifDateToIso(dt?: string): string | undefined {
  const m = dt?.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

export type ExifScan = { hasExif: boolean; markers: string[] };

/**
 * フォーマット非依存の EXIF 残存スキャン（自動検査用）。
 * 派生(WebP/AVIF)や JPEG に EXIF セグメント/チャンクが無いことをアサートするために使う。
 * 見つかったマーカー種別を返す（JPEG APP1 / WebP EXIF / PNG eXIf）。
 */
export function scanForExif(bytes: Uint8Array): ExifScan {
  const markers: string[] = [];

  // JPEG: APP1 セグメントの "Exif\0\0"
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const tiff = findExifTiffStart(bytes);
    if (tiff >= 0) markers.push("jpeg-app1-exif");
  }

  // WebP(RIFF): "EXIF" チャンク
  if (
    bytes.length > 16 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // "WEBP"
  ) {
    if (containsAscii(bytes, "EXIF")) markers.push("webp-exif");
  }

  // PNG: "eXIf" チャンク
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    if (containsAscii(bytes, "eXIf")) markers.push("png-exif");
  }

  return { hasExif: markers.length > 0, markers };
}

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const n = needle.length;
  for (let i = 0; i + n <= bytes.length; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}
