import "server-only";
import type { TableMap, TableName } from "@/lib/types";
import { env } from "@/lib/env";
import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";

export type Row<T extends TableName> = TableMap[T];

export interface ListOptions<T extends TableName> {
  /** Exact-match filters. */
  where?: Partial<Record<keyof Row<T>, string | number | boolean | null>>;
  /** Rows where the array column contains the value. */
  contains?: { column: keyof Row<T>; value: string };
  /** Rows where column is one of the values. */
  in?: { column: keyof Row<T>; values: string[] };
  orderBy?: { column: keyof Row<T>; ascending?: boolean };
  limit?: number;
  offset?: number;
}

export interface Store {
  readonly kind: "local" | "supabase";
  list<T extends TableName>(table: T, opts?: ListOptions<T>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  insertMany<T extends TableName>(table: T, rows: Row<T>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T> | null>;
  upsert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
  /** Case-insensitive substring search across text columns. */
  search<T extends TableName>(table: T, columns: (keyof Row<T>)[], q: string, limit?: number): Promise<Row<T>[]>;
}

const g = globalThis as unknown as { __ptStore?: Store };

export function db(): Store {
  if (!g.__ptStore) {
    g.__ptStore = env.supabaseConfigured ? new SupabaseStore() : new LocalStore();
  }
  return g.__ptStore;
}

export function newId(prefix = ""): string {
  return prefix + crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
