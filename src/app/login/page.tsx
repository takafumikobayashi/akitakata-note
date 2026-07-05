import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminPassword, AUTH_COOKIE, isAuthed, issueTokenIfValid } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "ログイン", robots: { index: false, follow: false } };

async function loginAction(formData: FormData): Promise<void> {
  "use server";
  const input = String(formData.get("password") ?? "");
  const token = await issueTokenIfValid(input);
  if (!token) redirect("/login?e=1");
  const jar = await cookies();
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/admin");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  // secret 未設定（ローカル）や認証済みなら管理へ
  if (!adminPassword() || (await isAuthed())) redirect("/admin");
  const { e } = await searchParams;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-lg">管理ログイン</h1>
      <form action={loginAction} className="space-y-4">
        <input
          type="password"
          name="password"
          autoFocus
          placeholder="パスワード"
          className="w-full rounded-sm border border-[color:var(--color-line)] bg-white px-3 py-2 text-sm"
        />
        {e && <p className="text-sm text-red-700">パスワードが違います。</p>}
        <button className="w-full rounded-sm bg-[color:var(--color-ink)] px-4 py-2 text-sm text-[color:var(--color-paper)]">
          ログイン
        </button>
      </form>
    </div>
  );
}
