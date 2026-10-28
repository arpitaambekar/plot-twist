import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TableName } from "@/lib/types";
import { env } from "@/lib/env";
import type { ListOptions, Row, Store } from "./index";

/**
 * File-backed store for local development (one JSON file per table under .data/).
 * Not for production: use Supabase (set the NEXT_PUBLIC_SUPABASE_* and SUPABASE_SERVICE_ROLE_KEY variables).
 */
export class LocalStore implements Store {
  readonly kind = "local" as const;
  private dir = path.resolve(process.cwd(), env.dataDir);
  private cache = new Map<string, { mtime: number; rows: Record<string, unknown>[] }>();

  private file(table: string) {
    return path.join(this.dir, `${table}.json`);
  }

  private read(table: string): Record<string, unknown>[] {
    const f = this.file(table);
    if (!fs.existsSync(f)) return [];
    const mtime = fs.statSync(f).mtimeMs;
    const hit = this.cache.get(table);
    if (hit && hit.mtime === mtime) return hit.rows;
    const rows = JSON.parse(fs.readFileSync(f, "utf8")) as Record<string, unknown>[];
    this.cache.set(table, { mtime, rows });
    return rows;
  }

  private write(table: string, rows: Record<string, unknown>[]) {
    fs.mkdirSync(this.dir, { recursive: true });
    const f = this.file(table);
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 1));
    fs.renameSync(tmp, f);
    this.cache.set(table, { mtime: fs.statSync(f).mtimeMs, rows });
  }

  async list<T extends TableName>(table: T, opts: ListOptions<T> = {}): Promise<Row<T>[]> {
    let rows = this.read(table).slice() as Record<string, unknown>[];
    if (opts.where) {
      for (const [k, val] of Object.entries(opts.where)) rows = rows.filter((r) => r[k] === val);
    }
    if (opts.contains) {
      const { column, value } = opts.contains;
      rows = rows.filter((r) => Array.isArray(r[column as string]) && (r[column as string] as unknown[]).includes(value));
    }
    if (opts.in) {
      const set = new Set(opts.in.values);
      rows = rows.filter((r) => set.has(String(r[opts.in!.column as string])));
    }
    if (opts.orderBy) {
      const c = opts.orderBy.column as string;
      const dir = opts.orderBy.ascending ? 1 : -1;
      rows.sort((a, b) => {
        const av = a[c] as string | number | null;
        const bv = b[c] as string | number | null;
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        return av > bv ? dir : -dir;
      });
    }
    const start = opts.offset ?? 0;
    rows = rows.slice(start, opts.limit ? start + opts.limit : undefined);
    return structuredClone(rows) as unknown as Row<T>[];
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const r = this.read(table).find((x) => x.id === id);
    return r ? (structuredClone(r) as unknown as Row<T>) : null;
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const rows = this.read(table).slice();
    rows.push(structuredClone(row) as unknown as Record<string, unknown>);
    this.write(table, rows);
    return row;
  }

  async insertMany<T extends TableName>(table: T, newRows: Row<T>[]): Promise<Row<T>[]> {
    if (!newRows.length) return [];
    const rows = this.read(table).slice();
    rows.push(...(structuredClone(newRows) as unknown as Record<string, unknown>[]));
    this.write(table, rows);
    return newRows;
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T> | null> {
    const rows = this.read(table).slice();
    const i = rows.findIndex((x) => x.id === id);
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...(structuredClone(patch) as Record<string, unknown>) };
    this.write(table, rows);
    return structuredClone(rows[i]) as unknown as Row<T>;
  }

  async upsert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const id = (row as unknown as { id: string }).id;
    const existing = await this.get(table, id);
    if (existing) return (await this.update(table, id, row)) as Row<T>;
    return this.insert(table, row);
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    this.write(
      table,
      this.read(table).filter((x) => x.id !== id),
    );
  }

  async search<T extends TableName>(table: T, columns: (keyof Row<T>)[], q: string, limit = 20): Promise<Row<T>[]> {
    const needle = q.toLowerCase();
    const rows = this.read(table).filter((r) =>
      columns.some((c) => {
        const val = r[c as string];
        if (typeof val === "string") return val.toLowerCase().includes(needle);
        if (Array.isArray(val)) return val.some((x) => typeof x === "string" && x.toLowerCase().includes(needle));
        return false;
      }),
    );
    return structuredClone(rows.slice(0, limit)) as unknown as Row<T>[];
  }
}
