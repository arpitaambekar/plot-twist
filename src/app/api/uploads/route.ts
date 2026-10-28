import { route, HttpError } from "@/lib/api";
import { burstLimit } from "@/lib/security/rate-limit";
import { safeUrl, sanitizeExternalText } from "@/lib/security/content";
import { audit } from "@/lib/audit";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Secure research upload for Campaign Studio. Accepts .docx or .pdf only (extension, MIME and
 * magic bytes are all checked), parses text server-side, strips markup and prompt-injection
 * phrasing, and returns it as untrusted research text. The file itself is not stored.
 */
export const POST = route("editor", async ({ user, req }) => {
  burstLimit(`upload:${user.id}`, 6, 6);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a Word (.docx) or PDF file.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "That file is larger than 8 MB. Please upload a smaller document.");
  const name = file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 120);
  const ext = name.toLowerCase().split(".").pop();
  const buf = Buffer.from(await file.arrayBuffer());

  let raw = "";
  if (ext === "docx") {
    if (file.type && file.type !== DOCX_MIME && file.type !== "application/octet-stream") throw new HttpError(415, "That file does not look like a Word document.");
    if (buf.subarray(0, 2).toString("latin1") !== "PK") throw new HttpError(415, "That file does not look like a valid .docx document.");
    const mammoth = await import("mammoth");
    raw = (await mammoth.extractRawText({ buffer: buf })).value;
  } else if (ext === "pdf") {
    if (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream") throw new HttpError(415, "That file does not look like a PDF.");
    if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new HttpError(415, "That file does not look like a valid PDF.");
    const pdf = (await import("pdf-parse/lib/pdf-parse.js")).default;
    raw = (await pdf(buf, { max: 60 })).text;
  } else {
    throw new HttpError(415, "Only Word (.docx) and PDF files are supported. For other formats, paste the text instead.");
  }

  // Preserve reference URLs found in the document so the provenance travels with the research.
  const urls = [...new Set((raw.match(/https?:\/\/[^\s)\]>"']+/g) ?? []).map((u) => safeUrl(u.replace(/[.,;]+$/, ""))).filter(Boolean) as string[])].slice(0, 60);
  const text = sanitizeExternalText(raw, 60000);
  if (text.length < 200) throw new HttpError(422, "We couldn't read enough text from that file. If it's a scanned PDF, paste the text instead.");
  const withRefs = urls.length ? `${text}\n\nReferences found in the document:\n${urls.join("\n")}` : text;
  await audit(user.email, "upload.research", name, { bytes: file.size, chars: text.length });
  return { filename: name, text: withRefs, chars: text.length, urls };
});
