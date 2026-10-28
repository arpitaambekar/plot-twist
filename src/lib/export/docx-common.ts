import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import type { ImageRef } from "@/lib/types";

/** Shared, editable Word formatting for every plot twist. export. */

const INK = "20252B";
const MUTED = "747D86";
const ACCENT = "4169D7";
const LINE = "E7E9EC";
const FONT = "Calibri";

export const FOOTER_TEXT = "Researched with plot twist. | Internal use";

export function h1(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 }, children: [new TextRun({ text, bold: true, size: 34, color: INK, font: FONT })] });
}
export function h2(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 260, after: 100 }, children: [new TextRun({ text, bold: true, size: 26, color: INK, font: FONT })] });
}
export function h3(text: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 60 }, children: [new TextRun({ text, bold: true, size: 22, color: INK, font: FONT })] });
}

/** Paragraph text; `cites` renders bracketed source numbers, e.g. [3][5]. */
export function para(text: string, opts: { cites?: number[]; italic?: boolean; color?: string; size?: number; label?: string } = {}) {
  const children: ParagraphChild[] = [];
  if (opts.label) children.push(new TextRun({ text: opts.label + "  ", bold: true, size: 16, color: ACCENT, font: FONT }));
  children.push(...multiline(text, { italics: opts.italic, color: opts.color ?? INK, size: opts.size ?? 21 }));
  if (opts.cites?.length) children.push(new TextRun({ text: " " + opts.cites.map((n) => `[${n}]`).join(""), size: 16, color: ACCENT, superScript: false, font: FONT }));
  return new Paragraph({ spacing: { after: 120, line: 300 }, children });
}

export function bullet(text: string, cites?: number[]) {
  const children: ParagraphChild[] = [...multiline(text, { color: INK, size: 21 })];
  if (cites?.length) children.push(new TextRun({ text: " " + cites.map((n) => `[${n}]`).join(""), size: 16, color: ACCENT, font: FONT }));
  return new Paragraph({ numbering: { reference: "pt-bullets", level: 0 }, spacing: { after: 60, line: 288 }, children });
}

function multiline(text: string, style: { italics?: boolean; color?: string; size?: number }) {
  const lines = String(text ?? "").split(/\n/);
  return lines.map((l, i) => new TextRun({ text: l, break: i > 0 ? 1 : undefined, font: FONT, ...style }));
}

export function label(text: string) {
  return new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: text.toUpperCase(), size: 16, bold: true, color: MUTED, characterSpacing: 40, font: FONT })] });
}

export function note(text: string) {
  return new Paragraph({
    spacing: { before: 80, after: 120 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: "EDF3FF" },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 6 } },
    children: [new TextRun({ text, size: 19, color: INK, font: FONT })],
  });
}

export function link(text: string, url: string) {
  return new ExternalHyperlink({ link: url, children: [new TextRun({ text, style: "Hyperlink", color: ACCENT, underline: {}, size: 19, font: FONT })] });
}

export function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

export function table(headers: string[], rows: string[][], widths?: number[]) {
  const cell = (t: string, head = false, w?: number) =>
    new TableCell({
      width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
      shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: "F3F4F6" } : undefined,
      margins: { top: 80, bottom: 80, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: head, size: 18, color: INK, font: FONT })] })],
    });
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, true, widths?.[i])) }), ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, false, widths?.[i])) }))],
  });
}

/** Download an image for embedding; only licensed ImageRefs are passed in. Failures are skipped silently. */
export async function imageParagraph(img: ImageRef | null | undefined, widthPx = 600): Promise<Paragraph[]> {
  if (!img?.url) return [];
  try {
    const res = await fetch(img.url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "plot-twist-internal/1.0" } });
    if (!res.ok) return [];
    const type = res.headers.get("content-type") ?? "";
    const kind = type.includes("png") ? "png" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : null;
    if (!kind) return [];
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return [];
    const height = Math.round(widthPx * 0.6);
    const credit = [img.author, img.license, img.provider].filter(Boolean).join(" · ");
    return [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: kind, data: buf, transformation: { width: widthPx, height } })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: `Photo: ${credit}`, size: 14, color: MUTED, font: FONT })] }),
    ];
  } catch {
    return [];
  }
}

export function coverPage(opts: { kicker: string; title: string; subtitle?: string; meta: string[] }) {
  return [
    new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: "plot twist", bold: true, size: 32, color: INK, font: FONT }), new TextRun({ text: ".", bold: true, size: 32, color: ACCENT, font: FONT })] }),
    new Paragraph({ spacing: { after: 1400 }, children: [new TextRun({ text: "There's always another story.", italics: true, size: 20, color: MUTED, font: FONT })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: opts.kicker.toUpperCase(), size: 18, bold: true, color: ACCENT, characterSpacing: 60, font: FONT })] }),
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: opts.title, bold: true, size: 64, color: INK, font: FONT })] }),
    ...(opts.subtitle ? [new Paragraph({ spacing: { after: 600 }, children: [new TextRun({ text: opts.subtitle, size: 26, color: MUTED, font: FONT })] })] : []),
    ...opts.meta.map((m) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: m, size: 19, color: MUTED, font: FONT })] })),
    pageBreak(),
  ];
}

export async function buildDocx(title: string, children: (Paragraph | Table)[]): Promise<Buffer> {
  const doc = new Document({
    title,
    creator: "plot twist.",
    description: FOOTER_TEXT,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK } } },
      characterStyles: [{ id: "Hyperlink", name: "Hyperlink", run: { color: ACCENT, underline: {} } }],
    },
    numbering: {
      config: [{ reference: "pt-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: FOOTER_TEXT + "   ·   Page ", size: 16, color: MUTED, font: FONT }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: FONT })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

export function docxResponse(buf: Buffer, filename: string) {
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
