import { hostOf, isOfficialDomain, normaliseForMatch, quoteAppearsIn } from "@/lib/security/content";
import type { ContactSource, ContactStatus } from "@/lib/types";

/**
 * Deterministic contact verification. Nothing the model says is trusted on its own:
 * a candidate survives only if its name and title genuinely appear in retrieved source text.
 */

export interface RetrievedText {
  url: string;
  title: string;
  publisher: string;
  text: string;
  published_at: string | null;
}

export interface CandidateRef {
  source: RetrievedText;
  quote: string;
}

const FREE_MAIL = /@(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|aol|proton(mail)?|rediffmail|ymail)\./i;
const STALE_MONTHS = 18;

/** Does the full name appear (as whole words) in the text? */
export function nameAppears(name: string, text: string): boolean {
  const n = normaliseForMatch(name);
  if (n.split(" ").length < 2) return false; // single names are too ambiguous to verify
  return ` ${normaliseForMatch(text)} `.includes(` ${n} `);
}

/** Does the job title appear in the text? Exact, or ≥75% of its meaningful words. */
export function titleAppears(title: string, text: string): boolean {
  const t = normaliseForMatch(title);
  const s = ` ${normaliseForMatch(text)} `;
  if (!t) return false;
  if (s.includes(` ${t} `)) return true;
  const words = t.split(" ").filter((w) => w.length > 2 && !["the", "and", "for", "of"].includes(w));
  if (words.length < 2) return false;
  const hits = words.filter((w) => s.includes(` ${w} `)).length;
  return hits / words.length >= 0.75;
}

/** A reference supports the candidate only if the quote is genuinely in the source and names the person, and the title is in the source. */
export function refSupports(ref: CandidateRef, fullName: string, jobTitle: string): boolean {
  if (!quoteAppearsIn(ref.quote, ref.source.text) && !normaliseForMatch(ref.source.text).includes(normaliseForMatch(ref.quote))) return false;
  if (!nameAppears(fullName, ref.quote) && !nameAppears(fullName, ref.source.text)) return false;
  if (!nameAppears(fullName, ref.source.text)) return false;
  return titleAppears(jobTitle, ref.source.text);
}

/** Only keep an email if that exact address is printed in a supporting source, and it is not a personal mailbox. */
export function verifiedEmail(email: string | null | undefined, texts: string[]): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e) || FREE_MAIL.test(e)) return null;
  return texts.some((t) => t.toLowerCase().includes(e)) ? e : null;
}

/** Only keep a phone number whose digits appear in sequence in a supporting source. */
export function verifiedPhone(phone: string | null | undefined, texts: string[]): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return texts.some((t) => t.replace(/\D/g, "").includes(digits)) ? phone.trim() : null;
}

export interface VerificationOutcome {
  status: ContactStatus;
  reason: string;
  sources: ContactSource[];
}

/** Map surviving references to a status, flagging outdated evidence. */
export function decideStatus(supporting: CandidateRef[], officialHosts: string[], now = Date.now()): VerificationOutcome {
  const retrieved = new Date(now).toISOString();
  const sources: ContactSource[] = [];
  const seen = new Set<string>();
  for (const r of supporting) {
    if (seen.has(r.source.url)) continue;
    seen.add(r.source.url);
    sources.push({
      url: r.source.url,
      title: r.source.title,
      publisher: r.source.publisher,
      is_official: isOfficialDomain(r.source.url, officialHosts),
      quote: r.quote.slice(0, 400),
      retrieved_at: retrieved,
    });
  }
  if (!sources.length) return { status: "Not Found", reason: "No retrieved source names this person in this role.", sources };

  const official = sources.find((s) => s.is_official);
  const hosts = new Set(sources.map((s) => hostOf(s.url)));
  const dates = supporting.map((r) => r.source.published_at).filter(Boolean).map((d) => new Date(d!).getTime());
  const newest = dates.length ? Math.max(...dates) : null;
  const stale = newest !== null && now - newest > STALE_MONTHS * 30 * 86400000;

  let status: ContactStatus;
  let reason: string;
  if (official) {
    status = "Officially Verified";
    reason = `Name and role appear on an official source (${hostOf(official.url)}).`;
  } else if (hosts.size >= 2) {
    status = "Cross-Verified";
    reason = `Name and role appear in ${hosts.size} independent sources (${[...hosts].slice(0, 3).join(", ")}).`;
  } else {
    status = "Needs Verification";
    reason = `Supported by a single third-party source (${[...hosts][0]}).`;
  }
  if (stale && status !== "Needs Verification" && !official) {
    status = "Needs Verification";
    reason += ` Newest supporting source is from ${new Date(newest!).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}, so the role may have changed.`;
  } else if (stale) {
    reason += ` Newest dated source is from ${new Date(newest!).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}; re-check before outreach.`;
  }
  return { status, reason, sources };
}

export function contactKey(name: string, org: string) {
  return `${normaliseForMatch(name)}|${normaliseForMatch(org).split(" ").slice(0, 3).join(" ")}`;
}
