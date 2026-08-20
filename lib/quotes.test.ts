import assert from "node:assert/strict";
import test from "node:test";
import { DONE_QUOTES, REST_QUOTES, pickQuote } from "./quotes.ts";

test("配列を空にしない（空だと pickQuote が undefined を返して画面が落ちる）", () => {
  assert.ok(REST_QUOTES.length > 0);
  assert.ok(DONE_QUOTES.length > 0);
});

test("本文と出典が両方 埋まっている", () => {
  for (const q of [...REST_QUOTES, ...DONE_QUOTES]) {
    assert.notEqual(q.text.trim(), "", `本文が空: ${q.by}`);
    assert.notEqual(q.by.trim(), "", `出典が空: ${q.text}`);
  }
});

test("pickQuote は渡した配列の中から返す", () => {
  for (let i = 0; i < 100; i++) {
    assert.ok(REST_QUOTES.includes(pickQuote(REST_QUOTES)));
    assert.ok(DONE_QUOTES.includes(pickQuote(DONE_QUOTES)));
  }
});
