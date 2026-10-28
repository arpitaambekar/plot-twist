/* eslint-disable @next/next/no-img-element */
import type { ImageRef } from "@/lib/types";
import { cn } from "@/lib/utils";

const PALETTES = [
  ["#EDF3FF", "#D9E4FB"],
  ["#EAF4EE", "#D4E8DB"],
  ["#FFF0E6", "#F8DDCB"],
  ["#F1EFEA", "#E4E0D7"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Licensed photo with optional attribution. With no reliable image we show a calm
 * typographic placeholder rather than an unrelated photograph.
 */
export function Photo({
  image,
  label,
  className,
  imgClassName,
  attribution = "hover",
  eager,
}: {
  image: ImageRef | null | undefined;
  label: string;
  className?: string;
  imgClassName?: string;
  attribution?: "hover" | "below" | "none";
  eager?: boolean;
}) {
  if (!image) {
    const [a, b] = PALETTES[hash(label) % PALETTES.length];
    return (
      <div
        className={cn("relative flex items-end overflow-hidden bg-ivory", className)}
        style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
        role="img"
        aria-label={`${label} (no licensed photo available)`}
      >
        <span className="p-4 text-[15px] font-semibold tracking-[-0.01em] text-ink/70">
          {label}
          <span className="text-accent">.</span>
        </span>
      </div>
    );
  }
  const credit = [image.author, image.license, image.provider].filter(Boolean).join(" · ");
  return (
    <figure className={cn("group relative overflow-hidden bg-ink/5", className)}>
      <img
        src={image.url}
        alt={image.alt || label}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn("h-full w-full object-cover", imgClassName)}
      />
      {attribution === "hover" && credit && (
        <figcaption className="pointer-events-none absolute bottom-0 right-0 max-w-full truncate rounded-tl-lg bg-ink/55 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          {image.source_page ? (
            <a href={image.source_page} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {credit}
            </a>
          ) : (
            credit
          )}
        </figcaption>
      )}
      {attribution === "below" && credit && (
        <figcaption className="mt-1 text-[11px] text-muted">
          Photo: {image.source_page ? <a href={image.source_page} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{credit}</a> : credit}
        </figcaption>
      )}
    </figure>
  );
}
