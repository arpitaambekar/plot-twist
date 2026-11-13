/**
 * Ways a published figure can be written: 2,100,000 / 21,00,000 / 2.1 million / 21 lakh / 2.1M.
 * Used to check that a source genuinely states a statistic, independent of formatting.
 */
export function numberVariants(v: number): string[] {
  const out = new Set<string>();
  const trim = (n: number, d: number) => String(Number(n.toFixed(d)));
  out.add(v.toLocaleString("en-US"));
  out.add(v.toLocaleString("en-IN"));
  if (v >= 1e6) {
    for (const d of [1, 2]) {
      const m = trim(v / 1e6, d);
      out.add(`${m} million`);
      out.add(`${m} mn`);
      out.add(`${m}m `);
    }
  }
  if (v >= 1e5) {
    for (const d of [0, 1, 2]) {
      const l = trim(v / 1e5, d);
      out.add(`${l} lakh`);
    }
  }
  if (v >= 1e7) for (const d of [1, 2]) out.add(`${trim(v / 1e7, d)} crore`);
  if (v >= 1e3 && v < 1e6) {
    out.add(`${trim(v / 1e3, 1)}k`);
    out.add(`${trim(v / 1e3, 1)} thousand`);
  }
  return [...out].map((s) => s.toLowerCase());
}

/** True when the text states the figure in any common format (rounded values only match their own rounding). */
export function textStatesNumber(text: string, v: number): boolean {
  const t = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  return numberVariants(v).some((variant) => {
    const i = t.indexOf(variant);
    if (i < 0) return false;
    // Avoid matching "2,100,0001" or "12.1 million": require a non-digit boundary on both sides.
    const before = t[i - 1] ?? " ";
    const after = t[i + variant.length] ?? " ";
    return !/[\d.,]/.test(before) && !/\d/.test(after);
  });
}
