import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql=await readFile(new URL("../supabase/migrations/006_player_external_identity.sql",import.meta.url),"utf8");
const normalized=sql.toLowerCase().replace(/\s+/g," ");

assert.match(sql,/alter table public\.players\s+add column if not exists fantrax_id text;/i);
assert.match(sql,/drop constraint if exists players_league_id_normalized_name_key;/i);
assert.match(sql,/drop index if exists public\.players_league_fantrax_unique;/i);
assert.match(sql,/drop index if exists public\.players_league_mlbam_unique;/i);
assert.match(sql,/create index if not exists players_league_normalized_name_idx\s+on public\.players \(league_id, normalized_name\);/i);
assert.match(sql,/create unique index players_league_fantrax_unique\s+on public\.players \(league_id, fantrax_id\)\s+where fantrax_id is not null\s+and btrim\(fantrax_id\) <> '';/i);
assert.match(sql,/create unique index players_league_mlbam_unique\s+on public\.players \(league_id, mlbam_id\)\s+where mlbam_id is not null;/i);
assert.match(sql,/notify pgrst, 'reload schema';/i);
assert.match(sql,/raise exception\s+'Duplicate Fantrax IDs detected/i);
assert.match(sql,/raise exception\s+'Duplicate MLBAM IDs detected/i);
assert.ok(!normalized.includes("delete from public.players"),"migration must not delete players");
assert.ok(!normalized.includes("merge into public.players"),"migration must not merge players");
assert.ok(!normalized.includes("update public.players set id"),"migration must not rewrite player UUIDs");

console.log("playerIdentityMigration tests passed");
