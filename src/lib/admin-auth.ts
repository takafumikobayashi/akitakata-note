/**
 * 管理UIの認証（OpenNext/Workers 上で動く cookie ベースの簡易ゲート）。
 * Next 16 の proxy は Node ランタイム専用で OpenNext 非対応のため、middleware ではなく
 * サーバーコンポーネント側で requireAdmin() を呼んで保護する。
 *
 * ADMIN_PASSWORD（wrangler secret）が未設定ならローカル開発とみなし通過。
 * 本番では必ず secret を設定すること。より堅くするなら /admin を Cloudflare Access 配下に置く。
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const AUTH_COOKIE = "aktkt_admin";

/** cookie 用トークン（パスワードから決定的に生成。平文をcookieに置かない） */
async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`aktkt:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function adminPassword(): string | undefined {
  return process.env.ADMIN_PASSWORD || undefined;
}

/** ログイン成功時に設定する cookie 値。パスワード不一致なら null */
export async function issueTokenIfValid(input: string): Promise<string | null> {
  const pass = adminPassword();
  if (!pass) return null;
  return input === pass ? tokenFor(pass) : null;
}

export async function isAuthed(): Promise<boolean> {
  const pass = adminPassword();
  if (!pass) return true; // 未設定＝ローカル開発は通過
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE)?.value;
  return !!token && token === (await tokenFor(pass));
}

/** 管理ページの先頭で呼ぶ。未認証なら /login へ */
export async function requireAdmin(): Promise<void> {
  if (!(await isAuthed())) redirect("/login");
}
