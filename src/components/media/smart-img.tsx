"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Image with two safeguards: a broken image falls back to `fallback`, and a low-resolution image
 * (narrower than `minWidth`) is shown at its natural size over a blurred copy instead of being stretched.
 */
export function SmartImg({ src, alt, className, eager, minWidth = 640, fallback }: { src: string; alt: string; className?: string; eager?: boolean; minWidth?: number; fallback: ReactNode }) {
  const [state, setState] = useState<"ok" | "small" | "broken">("ok");
  const ref = useRef<HTMLImageElement>(null);
  const check = (el: HTMLImageElement) => {
    if (!el.complete) return;
    if (el.naturalWidth === 0) setState("broken");
    else if (el.naturalWidth < minWidth) setState("small");
  };
  // Images that finished loading (or failing) before hydration never fire onLoad/onError for React.
  useEffect(() => {
    if (ref.current) check(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  if (state === "broken") return <>{fallback}</>;
  const img = (cls: string, withRef = true) => (
    <img
      ref={withRef ? ref : undefined}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setState("broken")}
      onLoad={(e) => state === "ok" && check(e.currentTarget)}
      className={cls}
    />
  );
  if (state === "small") {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <img src={src} alt="" aria-hidden referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
        <div className="relative flex h-full w-full items-center justify-center p-4">{img("max-h-full max-w-full rounded-lg object-contain shadow-[var(--shadow-card)]", false)}</div>
      </div>
    );
  }
  return img(cn("h-full w-full object-cover", className));
}
