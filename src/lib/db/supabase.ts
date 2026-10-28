import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TableName } from "@/lib/types";
import { env } from "@/lib/env";
import type { ListOptions, Row, Store } from "./index";

/**
 * Production store. Uses the service-role key on the server only; every API route
 * performs its own role check (lib/auth) before touching data, and RLS policies in
 * supabase/migrations restrict any direct client access to authenticated internal users.
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(env.supabaseUrl!, env.supabaseServiceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private fail(op: string, table: string, error: { message: string } | null): never {
    throw new Error(`Database ${op} on ${table} failed: ${error?.message ?? "unknown error"}`);
  }

  async list<T extends TableName>(table: T, opts: ListOptions<T> = {}): Promise<Row<T>[]> {
    let q = this.client.from(table).select("*");
    if (opts.where) {
      for (const [k, val] of Object.entries(opts.where)) q = val === null ? q.is(k, null) : q.eq(k, val as string);
    }
    if (opts.contains) q = q.contains(opts.contains.column as string, [opts.contains.value]);
    if (opts.in) q = q.in(opts.in.column as string, opts.in.values);
    if (opts.orderBy) q = q.order(opts.orderBy.column as string, { ascending: Boolean(opts.orderBy.ascending), nullsFirst: false });
    if (opts.limit) {
      const start = opts.offset ?? 0;
      q = q.range(start, start + opts.limit - 1);
    }
    const { data, error } = await q;
    if (error) this.fail("list", table, error);
    return (data ?? []) as Row<T>[];
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) this.fail("get", table, error);
    return (data as Row<T>) ?? null;
  }

  async insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const { data, error } = await this.client.from(table).insert(row as never).select().single();
    if (error) this.fail("insert", table, error);
    return data as Row<T>;
  }

  async insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<Row<T>[]> {
    if (!rows.length) return [];
    const { data, error } = await this.client.from(table).insert(rows as never[]).select();
    if (error) this.fail("insertMany", table, error);
    return (data ?? []) as Row<T>[];
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T> | null> {
    const { data, error } = await this.client.from(table).update(patch as never).eq("id", id).select().maybeSingle();
    if (error) this.fail("update", table, error);
    return (data as Row<T>) ?? null;
  }

  async upsert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>> {
    const { data, error } = await this.client.from(table).upsert(row as never).select().single();
    if (error) this.fail("upsert", table, error);
    return data as Row<T>;
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) this.fail("remove", table, error);
  }

  async search<T extends TableName>(table: T, columns: (keyof Row<T>)[], q: string, limit = 20): Promise<Row<T>[]> {
    // Escape PostgREST filter syntax characters before building the or() expression.
    const safe = q.replace(/[%,()*\\]/g, " ").trim();
    if (!safe) return [];
    const expr = columns.map((c) => `${String(c)}.ilike.%${safe}%`).join(",");
    const { data, error } = await this.client.from(table).select("*").or(expr).limit(limit);
    if (error) this.fail("search", table, error);
    return (data ?? []) as Row<T>[];
  }
}
