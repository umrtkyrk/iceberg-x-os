import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import postcss from "postcss";

const root = new URL("../src/pages/forum/", import.meta.url);
const load = (file, dependencies = {}) => {
  const code = ts.transpileModule(readFileSync(new URL(file, root), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => dependencies[name],
  });
  return module.exports;
};
const model = load("forumModel.ts");
const { migrateLegacyState } = load("legacyState.ts", {
  "./forumModel": model,
});
const topic = {
  id: "sample-new",
  title: "Example discussion",
  authorId: "sample-selin",
  body: "Context",
  categoryId: "help",
  questId: null,
  createdAt: "2026-10-27T10:00:00Z",
  replies: [],
  views: 0,
  tags: [],
};

test("legacy migration keeps authored work without assigning synthetic messages to the viewer", () => {
  const old = {
    topics: [
      { ...topic, id: "old-demo", authorId: "mesut" },
      {
        ...topic,
        id: "own",
        authorId: "user-id",
        replies: [
          {
            id: "r",
            authorId: "selin",
            body: "Reply",
            createdAt: topic.createdAt,
          },
        ],
      },
      {
        ...topic,
        id: "own-reply",
        authorId: "mesut",
        replies: [
          {
            id: "r2",
            authorId: "user-id",
            body: "Real draft",
            createdAt: topic.createdAt,
          },
        ],
      },
    ],
    saved: ["old-demo", "own"],
    settings: { signature: "Keep my signature" },
  };
  const migrated = migrateLegacyState(old, "user-id", [topic]);
  assert.deepEqual(
    Array.from(migrated.topics, (row) => row.id),
    ["own", "own-reply", "sample-new"],
  );
  assert.equal(migrated.topics[0].authorId, "user-id");
  assert.equal(migrated.topics[0].replies[0].authorId, "sample-selin");
  assert.equal(migrated.topics[1].authorId, "legacy-example");
  assert.equal(migrated.topics[1].replies[0].authorId, "user-id");
  assert.equal(migrated.settings.signature, "Keep my signature");
  assert.deepEqual(Array.from(migrated.saved), ["own"]);
});

test("forum CSS remains isolated from every other portal page", () => {
  const css = postcss.parse(readFileSync(new URL("forum.css", root), "utf8"));
  css.walkRules((rule) => {
    if (rule.parent.type === "atrule" && /keyframes$/.test(rule.parent.name))
      return;
    for (const selector of rule.selectors)
      assert.ok(selector.startsWith(".cube-forum-v2"), selector);
  });
});
