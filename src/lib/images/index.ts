import "server-only";
import { env } from "@/lib/env";
import { sanitizeExternalText } from "@/lib/security/content";
import type { ImageRef } from "@/lib/types";

/**
 * Licensed photography. Wikimedia Commons is the default (no key needed; only freely licensed
 * files: CC0, CC BY, CC BY-SA, public domain). Unsplash/Pexels are used if keys are configured.
 * Attribution and licence are stored alongside every image. If nothing reliable is found we
 * return null and the UI shows a tasteful placeholder, never an unrelated photo.
 */

const memo = new Map<string, Promise<ImageRef | null>>();
const ALLOWED_LICENSES = /^(cc0|cc[- ]by(-sa)?[- ]?\d|cc[- ]by(-sa)?$|public domain|pd)/i;
const UA = "plot-twist-internal/1.0 (travel research tool)";

interface CommonsPage {
  title: string;
  imageinfo?: {
    thumburl?: string;
    url: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime?: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
}

async function commonsQuery(params: Record<string, string>): Promise<CommonsPage[]> {
  const qs = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "1600",
    origin: "*",
    ...params,
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${qs}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: 60 * 60 * 24 * 7 },
  } as RequestInit);
  if (!res.ok) return [];
  const body = (await res.json()) as { query?: { pages?: Record<string, CommonsPage & { index?: number }> } };
  return Object.values(body.query?.pages ?? {}).sort((a, b) => ((a as { index?: number }).index ?? 0) - ((b as { index?: number }).index ?? 0));
}

function toRef(p: CommonsPage, alt: string): ImageRef | null {
  const ii = p.imageinfo?.[0];
  if (!ii) return null;
  if (ii.mime && !/jpeg|png|webp/.test(ii.mime)) return null;
  if (ii.width < 1000 || ii.width < ii.height) return null; // landscape, reasonably large only
  const meta = ii.extmetadata ?? {};
  const license = sanitizeExternalText(meta.LicenseShortName?.value ?? "", 60);
  if (!license || !ALLOWED_LICENSES.test(license)) return null;
  return {
    url: ii.thumburl ?? ii.url,
    alt,
    provider: "Wikimedia Commons",
    author: sanitizeExternalText(meta.Artist?.value ?? "", 120) || null,
    license,
    license_url: meta.LicenseUrl?.value ?? null,
    source_page: ii.descriptionurl,
  };
}

async function commonsByFile(file: string, alt: string) {
  const pages = await commonsQuery({ titles: `File:${file}` });
  return pages.map((p) => toRef(p, alt)).find(Boolean) ?? null;
}

async function commonsSearch(query: string, alt: string) {
  const pages = await commonsQuery({ generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "12" });
  return pages.map((p) => toRef(p, alt)).find(Boolean) ?? null;
}

async function unsplash(query: string, alt: string): Promise<ImageRef | null> {
  if (!env.unsplashKey) return null;
  const res = await fetch(`https://api.unsplash.com/search/photos?${new URLSearchParams({ query, orientation: "landscape", per_page: "1" })}`, {
    headers: { Authorization: `Client-ID ${env.unsplashKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { results?: { urls: { regular: string }; user: { name: string; links: { html: string } }; links: { html: string } }[] };
  const r = body.results?.[0];
  if (!r) return null;
  return { url: r.urls.regular, alt, provider: "Unsplash", author: r.user.name, license: "Unsplash License", license_url: "https://unsplash.com/license", source_page: r.links.html };
}

/** Find a licensed photo. `file` is a known Commons filename to try first. */
export function findPhoto(query: string, opts: { alt?: string; file?: string | null } = {}): Promise<ImageRef | null> {
  if (env.demoFixtures) return Promise.resolve(null);
  const key = `${opts.file ?? ""}|${query}`;
  if (!memo.has(key)) {
    const alt = opts.alt ?? query;
    const p = (async () => {
      try {
        if (opts.file) {
          const byFile = await commonsByFile(opts.file, alt);
          if (byFile) return byFile;
        }
        return (await commonsSearch(query, alt)) ?? (await unsplash(query, alt));
      } catch {
        return null;
      }
    })();
    memo.set(key, p);
    p.then((r) => {
      if (!r) setTimeout(() => memo.delete(key), 10 * 60 * 1000); // retry misses later
    });
  }
  return memo.get(key)!;
}

export async function findPhotos(items: { query: string; alt?: string }[], concurrency = 4): Promise<(ImageRef | null)[]> {
  const out: (ImageRef | null)[] = new Array(items.length).fill(null);
  let i = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await findPhoto(items[idx].query, { alt: items[idx].alt });
      }
    }),
  );
  return out;
}
