import {
  childDirPath,
  dirSegments,
  isDirPath,
  isValidName,
  MAX_CAPTION_LENGTH,
  MAX_NAME_LENGTH,
  parentDirPath,
  parseCaption,
  ROOT_DIR_PATH,
  serialiseCaption,
  type FileCaption,
} from "@/format/caption";

function caption(file: FileCaption): string {
  const r = serialiseCaption(file);
  if (!r.ok) throw new Error(r.error);
  return r.caption;
}

describe("serialiseCaption", () => {
  it("writes the spec example", () => {
    expect(caption({ dirPath: "Holiday/Beach", name: "IMG_001.jpg" })).toBe(
      'fileharbor:1:{"path":["Holiday","Beach"],"name":"IMG_001.jpg"}',
    );
  });

  it("writes a file in the root with an empty path", () => {
    expect(caption({ dirPath: ROOT_DIR_PATH, name: "a.pdf" })).toBe(
      'fileharbor:1:{"path":[],"name":"a.pdf"}',
    );
  });

  it("keeps non-ASCII text as it is, and escapes quotes and backslashes", () => {
    expect(
      caption({ dirPath: "छुट्टी 2026", name: 'say "hi" \\ 🎉.txt' }),
    ).toBe(
      'fileharbor:1:{"path":["छुट्टी 2026"],"name":"say \\"hi\\" \\\\ 🎉.txt"}',
    );
  });

  it.each([
    [{ dirPath: "Holiday/", name: "a.jpg" }],
    [{ dirPath: "/Holiday", name: "a.jpg" }],
    [{ dirPath: "Holiday//Beach", name: "a.jpg" }],
    [{ dirPath: " Holiday", name: "a.jpg" }],
    [{ dirPath: "Holiday", name: "" }],
    [{ dirPath: "Holiday", name: "a/b.jpg" }],
    [{ dirPath: "Holiday", name: "a\nb.jpg" }],
    [{ dirPath: "..", name: "a.jpg" }],
  ])("rejects a bad name: %j", (file) => {
    expect(serialiseCaption(file)).toEqual({ ok: false, error: "bad_name" });
  });

  it("rejects a caption that is too long", () => {
    const long = "a".repeat(MAX_NAME_LENGTH);
    const file = { dirPath: [long, long, long, long].join("/"), name: "x.jpg" };
    expect(serialiseCaption(file)).toEqual({ ok: false, error: "too_long" });
  });

  it("accepts a caption of exactly the maximum length", () => {
    const dirPath = ["c", "c", "c"]
      .map((c) => c.repeat(MAX_NAME_LENGTH))
      .join("/");
    const base = caption({ dirPath, name: "b" }).length;
    const name = "b".repeat(1 + MAX_CAPTION_LENGTH - base);
    const r = serialiseCaption({ dirPath, name });
    expect(r.ok && r.caption.length).toBe(MAX_CAPTION_LENGTH);
    expect(serialiseCaption({ dirPath, name: `${name}b` })).toEqual({
      ok: false,
      error: "too_long",
    });
  });
});

describe("parseCaption", () => {
  it("reads the spec example", () => {
    expect(
      parseCaption(
        'fileharbor:1:{"path":["Holiday","Beach"],"name":"IMG_001.jpg"}',
      ),
    ).toEqual({
      ok: true,
      value: { dirPath: "Holiday/Beach", name: "IMG_001.jpg" },
    });
  });

  it("reads spaces and unknown keys, so a later version 1 caption still parses", () => {
    expect(
      parseCaption(
        'fileharbor:1:{ "name": "a.jpg", "sha256": "ab", "path": [ "X" ] }',
      ),
    ).toEqual({ ok: true, value: { dirPath: "X", name: "a.jpg" } });
  });

  it("reads a caption with a space at the end", () => {
    expect(parseCaption('fileharbor:1:{"path":[],"name":"a"} ')).toEqual({
      ok: true,
      value: { dirPath: "", name: "a" },
    });
  });

  it.each([
    "",
    "holiday photos",
    "dir--0/-OfbIM-MZ14I7p79snqB--/dir",
    " -u-t-s-1700000000000-e-n-d-  13fs4r356ce2 ",
    ' fileharbor:1:{"path":[],"name":"a"}',
    'FileHarbor:1:{"path":[],"name":"a"}',
    'fileharbor:2:{"path":[],"name":"a"}',
  ])("gives not_fileharbor for %j", (text) => {
    expect(parseCaption(text)).toEqual({ ok: false, error: "not_fileharbor" });
  });

  it.each([
    "fileharbor:1:",
    "fileharbor:1:{",
    "fileharbor:1:null",
    'fileharbor:1:["a"]',
    'fileharbor:1:{"path":[],"name":"a"}x',
    'fileharbor:1:{"name":"a"}',
    'fileharbor:1:{"path":[]}',
    'fileharbor:1:{"path":"X","name":"a"}',
    'fileharbor:1:{"path":[1],"name":"a"}',
    'fileharbor:1:{"path":[""],"name":"a"}',
    'fileharbor:1:{"path":["a/b"],"name":"a"}',
    'fileharbor:1:{"path":["X"],"name":""}',
    'fileharbor:1:{"path":["X"],"name":" a"}',
    'fileharbor:1:{"path":["X"],"name":"a\\u0000"}',
    'fileharbor:1:{"path":["X"],"name":"\\ud800"}',
    'fileharbor:1:{"path":["X"],"name":7}',
  ])("gives bad_caption for %j", (text) => {
    expect(parseCaption(text)).toEqual({ ok: false, error: "bad_caption" });
  });
});

// A seeded generator, so a failure can be run again with the same input.
function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Letters, digits, punctuation, JSON escapes, the old "--" markers, Devanagari, and an emoji
// (a surrogate pair). No "/" and no control character: those are not valid in a name.
const CHARS = [
  ..."abcXYZ019 .-_()[]{},:;'\"\\`~!@#$%^&*+=?<>|",
  "--",
  "dir",
  "छ",
  "ु",
  "é",
  "🎉",
];

function randomName(next: () => number): string {
  let name = "";
  const length = 1 + Math.floor(next() * 12);
  for (let i = 0; i < length; i++)
    name += CHARS[Math.floor(next() * CHARS.length)];
  name = name.trim();
  return isValidName(name) ? name : "n";
}

describe("round trip", () => {
  it("parse(serialise(file)) gives the same file, and serialise is stable", () => {
    const next = lcg(57);
    for (let i = 0; i < 2000; i++) {
      const depth = Math.floor(next() * 4);
      const dirPath = Array.from({ length: depth }, () =>
        randomName(next),
      ).join("/");
      const file = { dirPath, name: randomName(next) };
      const text = caption(file);
      const parsed = parseCaption(text);
      expect(parsed).toEqual({ ok: true, value: file });
      if (parsed.ok) expect(caption(parsed.value)).toBe(text);
    }
  });
});

describe("names and paths", () => {
  it.each([
    "a",
    "My files",
    "a.b.c",
    "...",
    "a--b",
    "छुट्टी",
    "🎉",
    "x".repeat(MAX_NAME_LENGTH),
  ])("accepts %j", (name) => expect(isValidName(name)).toBe(true));

  it.each([
    "",
    " ",
    " a",
    "a ",
    ".",
    "..",
    "a/b",
    "a\tb",
    "a\u007Fb",
    "a\u0085b",
    "\ud83c",
    "\udf89",
    "x".repeat(MAX_NAME_LENGTH + 1),
  ])("rejects %j", (name) => expect(isValidName(name)).toBe(false));

  it("splits and checks dir paths", () => {
    expect(dirSegments(ROOT_DIR_PATH)).toEqual([]);
    expect(dirSegments("A/B")).toEqual(["A", "B"]);
    expect(isDirPath(ROOT_DIR_PATH)).toBe(true);
    expect(isDirPath("A/B")).toBe(true);
    expect(isDirPath("A//B")).toBe(false);
  });

  it("gives the parent", () => {
    expect(parentDirPath(ROOT_DIR_PATH)).toBeNull();
    expect(parentDirPath("A")).toBe(ROOT_DIR_PATH);
    expect(parentDirPath("A/B")).toBe("A");
  });

  it("gives a child, or null for a bad name", () => {
    expect(childDirPath(ROOT_DIR_PATH, "A")).toBe("A");
    expect(childDirPath("A", "B")).toBe("A/B");
    expect(childDirPath("A", "B/C")).toBeNull();
    expect(childDirPath("A", "")).toBeNull();
    expect(childDirPath("A//B", "C")).toBeNull();
  });
});
