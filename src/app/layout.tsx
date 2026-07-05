import type { Metadata } from "next";
import { Noto_Sans_JP, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-zen-kaku",
  display: "swap",
});

export const metadata: Metadata = {
  // 個人運営のローカルメディア。行政公式と誤認させない（05_public_private_policy.md）
  title: {
    default: "あきたかたノート",
    template: "%s｜あきたかたノート",
  },
  description:
    "安芸高田市の“いまの空気”と“暮らしの解像度”を、写真・場所・時期・テーマで記録する、個人運営のローカルメディア。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} ${zenKaku.variable}`}>
      <body>{children}</body>
    </html>
  );
}
