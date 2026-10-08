import { drizzle } from "drizzle-orm/d1";
import type { Env } from "./env";

export type Db = ReturnType<typeof drizzle>;

export function openDb(env: Env): Db {
  return drizzle(env.DB);
}
