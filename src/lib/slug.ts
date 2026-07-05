/**
 * ASCII slug 生成（ADR-0006）。内部URLは ASCII 固定。
 * タイトルが ASCII 主体ならそれを slug 化し、日本語主体なら日付＋乱数へフォールバック。
 * 翻字（ローマ字）の本格対応は運用で slug 手編集に委ねる（MVP方針）。
 */
export function toAsciiSlug(input: string, fallbackPrefix = "post"): string {
  const ascii = input
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "") // 非ASCIIを除去
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  if (ascii.length >= 3) return ascii;

  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 7);
  return `${fallbackPrefix}-${ymd}-${rand}`;
}
