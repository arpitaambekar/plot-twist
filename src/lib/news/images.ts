import { safeUrl } from "@/lib/security/content";

/** Feed media entries carry optional width attributes; pick the largest still image. */
export function pickFeedImage(item: {
  mediaContent?: { $?: { url?: string; medium?: string; width?: string; type?: string } }[];
  mediaThumbnail?: { $?: { url?: string; width?: string } };
  enclosure?: { url?: string; type?: string };
}): string | null {
  const media = (item.mediaContent ?? [])
    .map((m) => m.$ ?? {})
    .filter((m) => m.url && m.medium !== "video" && !(m.type ?? "").startsWith("video"))
    .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0));
  const candidates = [media[0]?.url, item.enclosure?.type?.startsWith("image") ? item.enclosure.url : undefined, item.mediaThumbnail?.$?.url];
  for (const c of candidates) {
    const u = safeUrl(c ?? null);
    if (u) return upgradeImageUrl(u);
  }
  return null;
}

/**
 * Many publishers serve resizable images; ask for a large version instead of the thumbnail.
 *  - Times Internet (ETTravelWorld etc.): ...,width-150,height-113,... -> width-1200,height-900
 *  - WordPress: photo-150x150.jpg -> photo.jpg (the original upload)
 *  - Query-string resizers: ?w=150 / ?width=150 -> 1200
 */
export function upgradeImageUrl(url: string): string {
  let u = url;
  u = u.replace(/width-(\d+),height-(\d+)/, (m, w, h) => {
    const W = Number(w);
    if (W >= 800) return m;
    return `width-1200,height-${Math.round((Number(h) / W) * 1200)}`;
  });
  u = u.replace(/-(\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp))/i, (m, w, _h, ext) => (Number(w) < 800 ? ext : m));
  u = u.replace(/([?&](?:w|width)=)(\d{2,3})(?=&|$)/i, (m, k, w) => (Number(w) < 800 ? `${k}1200` : m));
  return u;
}

/** Heuristic: URL still looks like a small thumbnail after upgrading. */
export function looksLikeThumbnail(url: string): boolean {
  return /thumb|thumbnail|[-_/]small[-_./]|width-\d{2,3},|[-_](?:1[0-9]{2}|[2-5][0-9]{2})x\d{2,3}\./i.test(url);
}

/** Extract the article's own preview image (og:image / twitter:image) from its HTML head. */
export function extractPreviewImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 200_000);
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const p of patterns) {
    const m = head.match(p);
    if (!m) continue;
    try {
      const abs = new URL(m[1].replace(/&amp;/g, "&"), pageUrl).toString();
      const safe = safeUrl(abs);
      if (safe && !/logo|favicon|placeholder|default[-_]?(?:image|og)/i.test(safe)) return safe;
    } catch {
      // ignore malformed URLs
    }
  }
  return null;
}
