"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { ImageRef } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Slide {
  name: string;
  place: string;
  line: string;
  image: ImageRef | null;
}

const INTERVAL = 5500;

/** Cinematic coverflow: a large centre story, partially visible neighbours, layered depth. */
export function DestinationCarousel({ slides, overlay }: { slides: Slide[]; overlay?: ReactNode }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touch = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const go = useCallback((d: number) => setIndex((i) => (i + d + n) % n), [n]);

  useEffect(() => {
    if (paused || userPaused || reduced) return;
    const t = setTimeout(() => go(1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, userPaused, reduced, go]);

  // Preload neighbours so transitions never show a blank card.
  useEffect(() => {
    [index + 1, index - 1].forEach((i) => {
      const s = slides[(i + n) % n];
      if (s?.image) {
        const img = new Image();
        img.src = s.image.url;
      }
    });
  }, [index, slides, n]);

  function offsetOf(i: number) {
    let o = i - index;
    if (o > n / 2) o -= n;
    if (o < -n / 2) o += n;
    return o;
  }

  const current = slides[index];

  return (
    <div
      className="relative mx-auto max-w-[1440px] select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
      role="region"
      aria-roledescription="carousel"
      aria-label="Destination stories"
      tabIndex={0}
    >
      <div className="relative h-[calc(100svh-150px)] min-h-[520px] max-h-[780px] [perspective:2000px]">
        {slides.map((s, i) => {
          const o = offsetOf(i);
          const abs = Math.abs(o);
          const visible = abs <= 2;
          return (
            <article
              key={s.name}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${n}: ${s.name}`}
              aria-hidden={o !== 0}
              onClick={() => o !== 0 && setIndex(i)}
              className={cn(
                "absolute left-1/2 top-0 h-full w-[88vw] overflow-hidden rounded-[26px] bg-ink md:w-[72vw] lg:w-[68vw]",
                !reduced && "transition-[transform,opacity,filter] duration-[900ms] ease-[cubic-bezier(0.22,0.8,0.2,1)]",
                o !== 0 && "cursor-pointer",
              )}
              style={{
                transform: `translateX(calc(-50% + ${o * 74}%)) translateZ(${-abs * 220}px) rotateY(${o * -4}deg) scale(${1 - abs * 0.12})`,
                opacity: visible ? (abs === 0 ? 1 : abs === 1 ? 0.9 : 0) : 0,
                filter: abs === 0 ? "none" : "saturate(0.8) brightness(0.92)",
                zIndex: 10 - abs,
                boxShadow: abs === 0 ? "0 30px 80px -20px rgba(32,37,43,0.45)" : "0 10px 30px -10px rgba(32,37,43,0.25)",
                pointerEvents: visible ? "auto" : "none",
              }}
            >
              {s.image ? (
                <img
                  src={s.image.url}
                  alt={s.image.alt}
                  className={cn("h-full w-full object-cover", !reduced && abs === 0 && "scale-[1.02] transition-transform duration-[6000ms] ease-out")}
                  loading={abs <= 1 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-start justify-end bg-gradient-to-br from-[#2b3440] via-[#3a4555] to-[#56627a] p-8">
                  <span className="text-[13px] text-white/40">Licensed photo unavailable</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.38),rgba(0,0,0,0.12)_60%,transparent)]" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
              <div className={cn("absolute bottom-0 left-0 p-6 text-left text-white md:p-9", abs !== 0 && "opacity-0")}>
                <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-white/75">{s.place}</p>
                <h2 className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.03em] md:text-[34px]">{s.name}<span className="text-[#9db4ff]">.</span></h2>
                <p className="mt-2 text-[15px] text-white/90 md:text-[16px]">“{s.line}”</p>
              </div>
              {s.image && abs === 0 && (
                <a
                  href={s.image.source_page ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-6 right-6 max-w-[40%] truncate rounded-full bg-black/30 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur hover:text-white"
                  tabIndex={o === 0 ? 0 : -1}
                >
                  Photo: {[s.image.author, s.image.license].filter(Boolean).join(" · ")}
                </a>
              )}
            </article>
          );
        })}
        {overlay && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6 pb-16">{overlay}</div>}
      </div>

      {/* Chapter markers: the page-marker motif. */}
      <div className="mx-auto mt-6 flex max-w-3xl items-center gap-4 px-5">
        <button onClick={() => go(-1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink/30" aria-label="Previous destination">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center gap-1.5" role="tablist" aria-label="Choose destination">
          {slides.map((s, i) => (
            <button
              key={s.name}
              role="tab"
              aria-selected={i === index}
              aria-label={s.name}
              onClick={() => setIndex(i)}
              className="group relative h-8 flex-1"
            >
              <span className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 overflow-hidden rounded-full bg-ink/10">
                <span
                  key={i === index ? `${index}-${paused || userPaused}` : undefined}
                  className={cn("block h-full bg-ink", i < index ? "w-full" : "w-0", i === index && (reduced || paused || userPaused ? "w-full" : "animate-[pt-progress_linear_forwards]"))}
                  style={i === index && !(reduced || paused || userPaused) ? { animationDuration: `${INTERVAL}ms` } : undefined}
                />
              </span>
              <span className={cn("absolute left-0 top-full mt-0.5 hidden text-[11px] font-medium tabular-nums transition-colors md:block", i === index ? "text-ink" : "text-muted/70 group-hover:text-ink")}>
                {String(i + 1).padStart(2, "0")}
              </span>
            </button>
          ))}
        </div>
        <button onClick={() => go(1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-ink/30" aria-label="Next destination">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          onClick={() => setUserPaused((p) => !p)}
          className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-ink sm:flex"
          aria-label={userPaused ? "Play carousel" : "Pause carousel"}
        >
          {userPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {current?.name}: {current?.line}
      </p>
    </div>
  );
}
