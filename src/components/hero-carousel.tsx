"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// デザイン確認用のデモ写真（trial-posts の実写真・人物なし。gitignore、本番は R2 派生に差し替え）
const images = [
  { src: "/hero/hero-1.jpg", alt: "土師ダムの春の湖畔" },
  { src: "/hero/hero-2.jpg", alt: "郡山城跡から見おろす安芸高田のまち" },
  { src: "/hero/hero-3.jpg", alt: "清神社の桜" },
];

// 無造作な縁（破った紙のような有機的マスク）。過剰にせず、ごく緩やかに。
const organicClip =
  "polygon(0% 3%, 14% 1%, 30% 4%, 48% 1.5%, 66% 4%, 84% 1%, 100% 3%, 100% 97%, 84% 99%, 64% 96%, 44% 99%, 22% 96%, 0% 98%)";

export function HeroCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // 「動きを減らす」設定なら自動送りしない（静けさ・アクセシビリティ）
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full">
      <div
        className="relative aspect-[4/3] w-full overflow-hidden bg-[color:var(--color-line)] sm:aspect-[16/7]"
        style={{ clipPath: organicClip }}
      >
        {images.map((img, i) => (
          <Image
            key={img.src}
            src={img.src}
            alt={img.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            className={`object-cover transition-opacity duration-[1200ms] ease-in-out ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {/* 現在位置のドット（左下、静かに） */}
      <div className="absolute bottom-6 left-6 flex gap-2 sm:left-10">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            aria-label={`写真 ${i + 1} を表示`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === index ? "bg-white" : "bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
