import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/pages/forum/forumModel.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const {
  STAGES,
  RARITY_ORDER,
  initials,
  safePreferences,
  readLocalState,
  canCompose,
} = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const seed = [
  {
    id: "topic-1",
    authorId: "author-1",
    title: "An example question",
    body: "Context",
    categoryId: "help",
    questId: null,
    createdAt: "2026-10-27T10:00:00Z",
    replies: [],
    views: 0,
    tags: [],
    pinned: false,
    unread: true,
  },
];

test("requested stage colours distinguish Cube blue and Iceberger gold without hiding text labels", () => {
  assert.equal(STAGES.cube.color, "#2563eb");
  assert.equal(STAGES.iceberger.color, "#a16207");
  assert.equal(STAGES.iceberger.soft, "#fffbeb");
  assert.equal(STAGES.candidate.label, "Senior Cube Candidate");
  assert.ok(RARITY_ORDER.Legendary < RARITY_ORDER.Epic);
});
test("initials tolerate absent names and preserve Turkish letters", () => {
  assert.equal(initials(null), "C");
  assert.equal(initials("  deniz   kaya "), "DK");
  assert.equal(initials("ilayda ışık"), "İI");
});
test("showcase retains no more than three unique owned badges in chosen order", () => {
  assert.deepEqual(
    safePreferences(
      {
        badgeIds: ["b", "foreign", "b", "a", "d", "c"],
        signature: "hello",
        id: "forged",
        stage: "admin",
      },
      ["a", "b", "c", "d"],
    ),
    { badgeIds: ["b", "a", "d"], signature: "hello" },
  );
  assert.deepEqual(safePreferences({ badgeIds: ["foreign"] }, []), {
    badgeIds: [],
    signature: "",
  });
  assert.equal(
    safePreferences({ signature: "x".repeat(200) }, []).signature.length,
    140,
  );
});
test("invalid root storage recovers to the seed without importing stored identity", () => {
  for (const raw of ["{", "null", "[]", '{"viewer":{"role":"ADMIN"}}'])
    assert.deepEqual(readLocalState(raw, seed), {
      topics: seed,
      saved: [],
      following: [],
      settings: { badgeIds: [], signature: "" },
    });
});
test("local state strips unknown fields, malformed records and duplicate IDs", () => {
  const state = readLocalState(
    JSON.stringify({
      viewer: { role: "ADMIN" },
      topics: [
        seed[0],
        seed[0],
        null,
        { ...seed[0], id: "bad", categoryId: "unknown" },
      ],
      saved: ["topic-1", "missing", "topic-1"],
      following: ["missing"],
      settings: { badgeIds: ["a"], signature: "sig", role: "ADMIN" },
    }),
    seed,
  );
  assert.equal(state.topics.length, 1);
  assert.deepEqual(state.saved, ["topic-1"]);
  assert.deepEqual(state.following, []);
  assert.equal("viewer" in state, false);
  assert.equal("role" in state.settings, false);
  assert.equal(state.topics[0].questId, null);
});
test("soft-deleted topics and replies remain deleted and their bodies are redacted", () => {
  const state = readLocalState(
    JSON.stringify({
      topics: [
        {
          ...seed[0],
          deleted: true,
          replies: [
            {
              id: "reply",
              authorId: "x",
              body: "removed",
              createdAt: seed[0].createdAt,
              deleted: true,
            },
          ],
        },
      ],
      saved: ["topic-1"],
      following: ["topic-1"],
    }),
    seed,
  );
  assert.equal(state.topics[0].deleted, true);
  assert.equal(state.topics[0].body, "");
  assert.equal(state.topics[0].replies[0].body, "");
  assert.equal(state.topics[0].replies[0].deleted, true);
  assert.deepEqual(state.saved, []);
});
test("announcement composer follows portal permission roles and rejects unknown categories", () => {
  assert.equal(canCompose("CUBE", "help"), true);
  assert.equal(canCompose("CUBE", "announcements"), false);
  assert.equal(canCompose("MENTOR", "announcements"), true);
  assert.equal(canCompose("ADMIN", "announcements"), true);
  assert.equal(canCompose("Iceberger", "help"), false);
  assert.equal(canCompose("ADMIN", "unknown"), false);
});
