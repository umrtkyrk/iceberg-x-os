import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import test from "node:test";

// Run from frontend/: node --test /absolute/path/to/portalContext.test.mjs
// Use the project's installed compiler; this does not install packages or call a live API.
const projectRequire = createRequire(
  resolve(process.env.FORUM_FRONTEND_DIR || process.cwd(), "package.json"),
);
const ts = projectRequire("typescript");
const source = readFileSync(
  fileURLToPath(
    new URL("../src/pages/forum/portalContext.ts", import.meta.url),
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    strict: true,
  },
  reportDiagnostics: true,
});
assert.equal(
  (compiled.diagnostics || []).filter(
    (item) => item.category === ts.DiagnosticCategory.Error,
  ).length,
  0,
);

test("adapter matches the strict forum contracts without opaque API payload types", () => {
  const sourcePath = fileURLToPath(
    new URL("../src/pages/forum/portalContext.ts", import.meta.url),
  );
  const apiContractPath = resolve(sourcePath, "../__forum_api_contract.d.ts");
  const apiContract =
    "export const api: { get<T = unknown>(endpoint: string): Promise<T> };";
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    name,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) =>
    name === apiContractPath
      ? ts.createSourceFile(name, apiContract, languageVersion)
      : originalGetSourceFile(
          name,
          languageVersion,
          onError,
          shouldCreateNewSourceFile,
        );
  host.resolveModuleNames = (names, containingFile) =>
    names.map((name) =>
      name === "../../utils/api"
        ? { resolvedFileName: apiContractPath, extension: ts.Extension.Dts }
        : ts.resolveModuleName(name, containingFile, options, host)
            .resolvedModule,
    );
  const program = ts.createProgram([sourcePath], options, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(
    errors.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(errors, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    }),
  );
});

function loadAdapter(
  respond = () => {
    throw new Error("Unexpected API request");
  },
) {
  const calls = [];
  const module = { exports: {} };
  const context = createContext({
    module,
    exports: module.exports,
    require(name) {
      assert.equal(name, "../../utils/api");
      return {
        api: {
          get: async (path) => {
            calls.push(path);
            return respond(path);
          },
        },
      };
    },
  });
  runInContext(compiled.outputText, context, { filename: "portalContext.ts" });
  return { ...module.exports, calls };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const pin = (id, extra = {}) => ({
  id,
  note: "Explained the problem clearly and helped us move forward.",
  tags: [{ key: "UNBLOCKER", label: "untrusted label" }],
  period: "Oct 2026",
  ...extra,
});
const publicProfile = () => ({
  profile: {
    id: "cube-1",
    cube_number: "007",
    cohort: "2026",
    university: "Example University",
    current_level: "Cube",
    avatar_url: "/uploads/avatars/cube.png",
    is_founding_cube: true,
    user: {
      id: "user-1",
      name: "Ada Cube",
      role: "CUBE",
      email: "PRIVATE_SENTINEL",
    },
    skills: ["TypeScript", "React", "React", null],
    cube_badges: [
      {
        badge: {
          id: "badge-1",
          name: "First Mission",
          icon: "Rocket",
          rarity: "Rare",
          description: "Completed a mission",
        },
        awarded_at: "2026-10-10T12:00:00Z",
        mission: { id: "m-1", title: "Build a tool" },
        reason: "PRIVATE_SENTINEL",
      },
    ],
    offboarding_record: { email_template: "PRIVATE_SENTINEL" },
    mentorFeedback: [{ private_notes: "PRIVATE_SENTINEL", score: 4.8 }],
    documents: [{ nda: "PRIVATE_SENTINEL" }],
  },
  peer_titles: [
    {
      category: "UNBLOCKER",
      label: "PRIVATE_SENTINEL",
      rarity: "Rare",
      giver_hash: "PRIVATE_SENTINEL",
    },
  ],
  pinned_quotes: [
    pin("pin-1", {
      giver: "PRIVATE_SENTINEL",
      context_id: "PRIVATE_SENTINEL",
      created_at: "PRIVATE_SENTINEL",
    }),
  ],
  stats: {
    questsCompleted: 3,
    missionContributions: 2,
    score: "PRIVATE_SENTINEL",
  },
  missions: [
    {
      missionId: "m-1",
      title: "Build a tool",
      status: "building_demo",
      private_notes: "PRIVATE_SENTINEL",
    },
  ],
  self: { growth_indicator: "PRIVATE_SENTINEL", received_count: 99 },
  concerns: "PRIVATE_SENTINEL",
});

test("public member projection retains only the author allowlist", () => {
  const adapter = loadAdapter();
  const member = plain(
    adapter.projectPublicMember(publicProfile(), {}, "candidate"),
  );
  assert.equal(member.id, "user-1");
  assert.equal(member.cubeId, "cube-1");
  assert.equal(member.portalRole, "CUBE");
  assert.equal(member.stage, "candidate");
  assert.deepEqual(member.skills, ["TypeScript", "React"]);
  assert.deepEqual(member.titles, [
    { category: "UNBLOCKER", label: "Unblocker", rarity: "Rare" },
  ]);
  assert.deepEqual(member.quotes[0].tags, [
    { key: "UNBLOCKER", label: "Unblocker" },
  ]);
  assert.equal(member.badges[0].missionTitle, "Build a tool");
  assert.equal(JSON.stringify(member).includes("PRIVATE_SENTINEL"), false);
  assert.deepEqual(
    Object.keys(member).sort(),
    [
      "id",
      "cubeId",
      "cubeNumber",
      "name",
      "initials",
      "stage",
      "portalRole",
      "avatarUrl",
      "cohort",
      "university",
      "skills",
      "founding",
      "sample",
      "badges",
      "titles",
      "quotes",
      "awards",
      "stats",
    ].sort(),
  );
  assert.equal(adapter.calls.length, 0);
});

test("recognition projection excludes private aggregates, non-positive tags and invalid consent rows", () => {
  const adapter = loadAdapter();
  const recognition = plain(
    adapter.projectPublicRecognition({
      titles: [
        { category: "UNBLOCKER", rarity: "Epic", self: "PRIVATE_SENTINEL" },
        { category: "NO_VISIBLE_CONTRIBUTION", rarity: "Rare" },
        { category: "constructor", rarity: "Common" },
      ],
      pinned: [
        pin("no-note", { note: "" }),
        pin("concern", { kind: "CONCERN" }),
        pin("dismissed", { status: "DISMISSED" }),
        pin("unpinned", { is_pinned: false }),
        pin("mentions-cube", { note: "Thanks to #007 for the help" }),
        pin("long", { note: "x".repeat(501) }),
        pin("unknown", { tags: ["constructor", "LOW_INITIATIVE"] }),
        pin("one", {
          period: "2026-10-01T00:00:00Z",
          tags: ["RELIABLE", "LOW_INITIATIVE"],
        }),
        pin("two"),
        pin("three"),
        pin("four"),
      ],
      awards: [
        {
          category: "RISING_STAR",
          period: "2026-10",
          note: "PRIVATE_SENTINEL",
        },
        { category: "NO_VISIBLE_CONTRIBUTION", period: "2026-10" },
        { category: "TEAM_GLUE", period: "2026-10-01" },
      ],
      self: {
        distinct_givers: 9,
        tags: { RELIABLE: 5 },
        growth_indicator: { message: "PRIVATE_SENTINEL" },
      },
      giver_hash: "PRIVATE_SENTINEL",
      concerns: "PRIVATE_SENTINEL",
      private_notes: "PRIVATE_SENTINEL",
      score: 5,
    }),
  );
  assert.deepEqual(recognition.titles, [
    { category: "UNBLOCKER", label: "Unblocker", rarity: "Epic" },
  ]);
  assert.deepEqual(
    recognition.quotes.map((quote) => quote.id),
    ["one", "two", "three"],
  );
  assert.equal(recognition.quotes[0].period, "");
  assert.deepEqual(recognition.quotes[0].tags, [
    { key: "RELIABLE", label: "Reliable" },
  ]);
  assert.deepEqual(recognition.awards, [
    { category: "RISING_STAR", label: "Rising Star", period: "2026-10" },
  ]);
  assert.equal(JSON.stringify(recognition).includes("PRIVATE_SENTINEL"), false);
  assert.deepEqual(Object.keys(recognition).sort(), [
    "awards",
    "quotes",
    "titles",
  ]);
});

test("empty and partial API shapes stay safe, and role is separate from programme level", () => {
  const adapter = loadAdapter();
  for (const input of [
    null,
    undefined,
    false,
    [],
    { profile: null },
    { profile: { user: null, cube_badges: [null] } },
  ]) {
    const member = adapter.projectPublicMember(input);
    assert.equal(member.name, "Cube");
    assert.equal(member.avatarUrl, null);
    assert.equal(member.badges.length, 0);
  }
  const payload = publicProfile();
  payload.profile.current_level = "Iceberger";
  assert.equal(adapter.projectPublicMember(payload).portalRole, "CUBE");
  assert.equal(adapter.projectPublicMember(payload).stage, "iceberger");
  payload.profile.current_level = "Former_Cube";
  assert.equal(
    adapter.projectPublicMember(payload, {}, "candidate").stage,
    "former",
  );
  payload.profile.user.role = "MENTOR";
  assert.equal(adapter.projectPublicMember(payload).stage, "mentor");
  payload.profile.avatar_url = "javascript:alert(1)";
  assert.equal(adapter.projectPublicMember(payload).avatarUrl, null);
});

test("context loads only approved reads, keeps own progress and removes staff/private payload fields", async () => {
  const adapter = loadAdapter((path) => {
    if (path === "/cubes/public/cube-1") return publicProfile();
    if (path === "/hall-of-fame")
      return {
        stages: {
          candidate: [{ id: "cube-1", name: "Ada Cube", cube_number: "007" }],
          iceberger: [
            {
              id: "cube-2",
              name: "Bora Cube",
              cube_number: "008",
              private_notes: "PRIVATE_SENTINEL",
            },
          ],
        },
      };
    if (path === "/quests")
      return [
        {
          id: "assignment-1",
          quest_id: "q-1",
          current_value: 2,
          is_completed: true,
          quest: {
            id: "q-1",
            title: "Help someone",
            criteria_value: 2,
            difficulty: "Common",
          },
        },
        {
          id: "assignment-2",
          quest_id: "q-2",
          current_value: 1,
          is_completed: false,
          quest: {
            id: "q-2",
            title: "Work together",
            criteria_value: 3,
            difficulty: "Rare",
            dependency_quest_id: "q-1",
          },
          cube: { mentorFeedback: "PRIVATE_SENTINEL" },
        },
        {
          id: "assignment-3",
          quest_id: "q-3",
          is_completed: false,
          quest: {
            id: "q-3",
            title: "Next challenge",
            criteria_value: 1,
            dependency_quest_id: "missing",
          },
        },
      ];
    if (path === "/cubes/cube-1/peer-summary")
      return {
        titles: [],
        pinned: [],
        awards: [{ category: "RISING_STAR", period: "2026-10" }],
        self: { growth_indicator: "PRIVATE_SENTINEL" },
      };
    throw new Error(`Unexpected endpoint ${path}`);
  });
  const result = plain(
    await adapter.loadPortalContext({
      id: "user-1",
      name: "Ada Cube",
      role: "CUBE",
      cubeProfileId: "cube-1",
    }),
  );
  assert.equal(result.viewer.id, "user-1");
  assert.equal(result.viewer.stage, "candidate");
  assert.equal(result.people.length, 2);
  assert.equal(result.people[1].stage, "iceberger");
  assert.equal(result.quests[0].current, 2);
  assert.equal(result.quests[1].locked, false);
  assert.equal(result.quests[2].locked, true);
  assert.equal(
    result.viewer.quotes.length,
    0,
    "a now-empty pinned collection must clear public quotes",
  );
  assert.deepEqual(result.missions, [
    { id: "m-1", title: "Build a tool", status: "building_demo" },
  ]);
  assert.deepEqual(result.hallCounts, {
    cube: 0,
    candidate: 1,
    senior: 0,
    iceberger: 1,
    mentor: 0,
  });
  assert.equal(JSON.stringify(result).includes("PRIVATE_SENTINEL"), false);
  assert.deepEqual(
    adapter.calls.sort(),
    [
      "/cubes/public/cube-1",
      "/hall-of-fame",
      "/quests",
      "/cubes/cube-1/peer-summary",
    ].sort(),
  );
});

test("staff quest definitions never turn another Cube assignment into viewer progress", async () => {
  const adapter = loadAdapter((path) => {
    if (path === "/hall-of-fame") return null;
    if (path === "/quests")
      return [
        {
          id: "q",
          title: "Mission progress",
          difficulty: "Epic",
          criteria_value: 5,
          cube_quests: [
            {
              cube_id: "other-cube",
              current_value: 5,
              is_completed: true,
              private_notes: "PRIVATE_SENTINEL",
            },
          ],
        },
      ];
    throw new Error("Staff without a Cube profile should not request one");
  });
  const result = await adapter.loadPortalContext({
    id: "mentor-1",
    name: "Mentor",
    role: "MENTOR",
  });
  assert.equal(result.viewer.stage, "mentor");
  assert.equal(result.quests[0].current, 0);
  assert.equal(result.quests[0].completed, false);
  assert.equal(JSON.stringify(result).includes("PRIVATE_SENTINEL"), false);
  assert.deepEqual(adapter.calls.sort(), ["/hall-of-fame", "/quests"]);
});

test("independent endpoint failures preserve the signed-in identity with generic notices", async () => {
  const adapter = loadAdapter(() => {
    throw new Error("PRIVATE_SENTINEL Prisma table detail");
  });
  const result = await adapter.loadPortalContext({
    id: "user-1",
    name: "Ada Cube",
    role: "CUBE",
    cubeProfileId: "cube-1",
  });
  assert.equal(result.viewer.name, "Ada Cube");
  assert.equal(result.notices.length, 3);
  assert.equal(result.people.length, 1);
  assert.equal(result.quests.length, 0);
  assert.equal(JSON.stringify(result).includes("PRIVATE_SENTINEL"), false);
});

test("public member requests coalesce and summary failure preserves chosen public recognition", async () => {
  const adapter = loadAdapter((path) => {
    if (path === "/cubes/public/cube-1") return publicProfile();
    if (path === "/cubes/cube-1/peer-summary")
      throw new Error("PRIVATE_SENTINEL");
    throw new Error(`Unexpected endpoint ${path}`);
  });
  const first = adapter.loadPublicMember("cube-1", "candidate");
  const second = adapter.loadPublicMember("cube-1", "candidate");
  assert.equal(first, second);
  const result = await first;
  assert.equal(result.quotes.length, 1);
  assert.equal(result.stage, "candidate");
  assert.equal(adapter.calls.length, 2);
  assert.equal(JSON.stringify(result).includes("PRIVATE_SENTINEL"), false);
});
