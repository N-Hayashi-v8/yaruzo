import assert from "node:assert/strict";
import test from "node:test";
import { logFor, putLog, todayKey } from "./store.ts";
import type { Store } from "./types.ts";

const empty: Store = { tasks: [], logs: [] };

test("todayKey はローカル日付を YYYY-MM-DD で返す", () => {
  assert.equal(todayKey(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});

test("記録が無ければ空の記録を返す（追加はしない）", () => {
  const log = logFor(empty, "2026-01-05");
  assert.deepEqual(log, { date: "2026-01-05", wakeAt: null, gotLight: false });
  assert.equal(empty.logs.length, 0);
});

test("putLog は同じ日付を差し替える", () => {
  const a = putLog(empty, { date: "2026-01-05", wakeAt: "07:20", gotLight: false });
  const b = putLog(a, { date: "2026-01-05", wakeAt: "07:20", gotLight: true });
  assert.equal(b.logs.length, 1);
  assert.equal(logFor(b, "2026-01-05").gotLight, true);
  assert.equal(logFor(a, "2026-01-05").gotLight, false); // 元は書き換えない
});

test("別の日付は足される", () => {
  const a = putLog(empty, { date: "2026-01-05", wakeAt: null, gotLight: true });
  const b = putLog(a, { date: "2026-01-06", wakeAt: null, gotLight: false });
  assert.equal(b.logs.length, 2);
});
