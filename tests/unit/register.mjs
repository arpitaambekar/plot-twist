// Resolves "@/x" imports to src/x.ts for node's built-in test runner (type stripping).
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
