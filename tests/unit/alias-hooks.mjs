import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = path.join(root, specifier.slice(2));
    for (const cand of [base + ".ts", base + ".tsx", path.join(base, "index.ts"), base]) {
      if (existsSync(cand)) return next(pathToFileURL(cand).href, context);
    }
  }
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  return next(specifier, context);
}
