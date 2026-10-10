import { openDatabaseAsync } from "expo-sqlite";

import type { IndexedFile } from "@/types/domain";

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));

type DbModule = typeof import("@/index/db");

const openMock = openDatabaseAsync as jest.Mock;
const LATEST = 2;

function fakeDb(userVersion: number) {
  const executed: unknown[][] = [];
  const statement = {
    executeAsync: jest.fn(async (...params: unknown[]) => {
      executed.push(params);
    }),
    finalizeAsync: jest.fn(async () => undefined),
  };
  const db = {
    execAsync: jest.fn(async (_sql: string) => undefined),
    runAsync: jest.fn(async (_sql: string, ..._params: unknown[]) => undefined),
    getFirstAsync: jest.fn(
      async (sql: string, ..._params: unknown[]): Promise<object | null> =>
        sql === "PRAGMA user_version" ? { user_version: userVersion } : null,
    ),
    getAllAsync: jest.fn(
      async (_sql: string, ..._params: unknown[]): Promise<object[]> => [
        {
          message_id: 9,
          dir_path: "A",
          name: "x.png",
          date: 5,
          size: 70,
          mime_type: "image/png",
        },
      ],
    ),
    prepareAsync: jest.fn(async () => statement),
    withExclusiveTransactionAsync: jest.fn(
      async (task: (tx: unknown) => Promise<void>) => {
        await task(db);
      },
    ),
  };
  return { db, statement, executed };
}

// db.ts keeps the open database in module state, so each test loads a fresh copy.
function loadDb(): DbModule {
  let mod: DbModule | undefined;
  jest.isolateModules(() => {
    mod = jest.requireActual<DbModule>("@/index/db");
  });
  return mod as DbModule;
}

function file(messageId: number, dirPath: string): IndexedFile {
  return {
    messageId,
    dirPath,
    name: `f${messageId}`,
    date: 10,
    size: 100,
    mimeType: "image/jpeg",
  };
}

afterEach(() => openMock.mockReset());

describe("migrations", () => {
  it("creates all tables on a new database", async () => {
    const { db } = fakeDb(0);
    openMock.mockResolvedValue(db);
    await loadDb().getFilesInDir("A");
    const sql = db.execAsync.mock.calls.map((c) => c[0]).join("\n");
    expect(sql).toContain("CREATE TABLE dir_index");
    expect(sql).toContain("CREATE INDEX idx_dir ON dir_index(dir_path)");
    expect(sql).toContain("ADD COLUMN size");
    expect(sql).toContain("ADD COLUMN mime_type");
    expect(sql).toContain("CREATE TABLE local_dir");
    expect(sql).toContain(`PRAGMA user_version = ${LATEST}`);
  });

  it("moves a version 1 database to version 2 only", async () => {
    const { db } = fakeDb(1);
    openMock.mockResolvedValue(db);
    await loadDb().getFilesInDir("A");
    const sql = db.execAsync.mock.calls.map((c) => c[0]).join("\n");
    expect(sql).not.toContain("CREATE TABLE dir_index");
    expect(sql).toContain("CREATE TABLE local_dir");
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it("does not migrate an up-to-date database", async () => {
    const { db } = fakeDb(LATEST);
    openMock.mockResolvedValue(db);
    await loadDb().getFilesInDir("A");
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it("opens the database once", async () => {
    const { db } = fakeDb(LATEST);
    openMock.mockResolvedValue(db);
    const mod = loadDb();
    await Promise.all([mod.getFilesInDir("A"), mod.getFilesInDir("A/B")]);
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it("gives an open error as a result, and tries again on the next call", async () => {
    const { db } = fakeDb(LATEST);
    openMock
      .mockRejectedValueOnce(new Error("cannot open"))
      .mockResolvedValue(db);
    const mod = loadDb();
    expect(await mod.getFilesInDir("A")).toEqual({
      ok: false,
      message: "cannot open",
    });
    expect((await mod.getFilesInDir("A")).ok).toBe(true);
  });
});

describe("dir_index", () => {
  it("replaces all rows in one transaction, then drops local folders that have files", async () => {
    const { db, statement, executed } = fakeDb(LATEST);
    openMock.mockResolvedValue(db);
    const files = [file(1, "A"), { ...file(2, "A/B"), size: 5, mimeType: "" }];
    expect(await loadDb().replaceDirIndex(files)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync.mock.calls[0][0]).toBe("DELETE FROM dir_index");
    expect(executed).toEqual([
      [1, "A", "f1", 10, 100, "image/jpeg"],
      [2, "A/B", "f2", 10, 5, ""],
    ]);
    expect(statement.finalizeAsync).toHaveBeenCalled();
    expect(db.runAsync.mock.calls[1][0]).toContain(
      "DELETE FROM local_dir WHERE EXISTS",
    );
  });

  it("maps rows to IndexedFile", async () => {
    const { db } = fakeDb(LATEST);
    openMock.mockResolvedValue(db);
    expect(await loadDb().getFilesInDir("A")).toEqual({
      ok: true,
      value: [
        {
          messageId: 9,
          dirPath: "A",
          name: "x.png",
          date: 5,
          size: 70,
          mimeType: "image/png",
        },
      ],
    });
    expect(db.getAllAsync.mock.calls[0][1]).toBe("A");
  });

  it("maps the grouped rows", async () => {
    const { db } = fakeDb(LATEST);
    db.getAllAsync.mockResolvedValueOnce([
      { dir_path: "A", file_count: 3, total_size: 300, media_count: 2 },
    ]);
    openMock.mockResolvedValue(db);
    expect(await loadDb().getDirSummaries()).toEqual({
      ok: true,
      value: [{ dirPath: "A", fileCount: 3, totalSize: 300, mediaCount: 2 }],
    });
    expect(db.getAllAsync.mock.calls[0][0]).toContain("GROUP BY dir_path");
  });

  it("clears both tables", async () => {
    const { db } = fakeDb(LATEST);
    openMock.mockResolvedValue(db);
    await loadDb().clearIndex();
    const sql = db.execAsync.mock.calls.map((c) => c[0]).join("\n");
    expect(sql).toContain("DELETE FROM dir_index");
    expect(sql).toContain("DELETE FROM local_dir");
  });
});

describe("getChildFolders", () => {
  function withRows(
    summaries: {
      dir_path: string;
      file_count: number;
      total_size: number;
      media_count: number;
    }[],
    local: string[],
  ) {
    const { db } = fakeDb(LATEST);
    db.getAllAsync
      .mockResolvedValueOnce(summaries)
      .mockResolvedValueOnce(local.map((dir_path) => ({ dir_path })));
    openMock.mockResolvedValue(db);
    return db;
  }

  it("adds the counts of the folders inside each folder, and sorts by name", async () => {
    withRows(
      [
        { dir_path: "", file_count: 4, total_size: 4, media_count: 4 },
        { dir_path: "Work", file_count: 2, total_size: 20, media_count: 0 },
        { dir_path: "Goa", file_count: 3, total_size: 30, media_count: 3 },
        {
          dir_path: "Goa/Beach",
          file_count: 5,
          total_size: 50,
          media_count: 1,
        },
      ],
      [],
    );
    expect(await loadDb().getChildFolders("")).toEqual({
      ok: true,
      value: [
        {
          dirPath: "Goa",
          name: "Goa",
          fileCount: 8,
          totalSize: 80,
          mediaCount: 4,
        },
        {
          dirPath: "Work",
          name: "Work",
          fileCount: 2,
          totalSize: 20,
          mediaCount: 0,
        },
      ],
    });
  });

  it("lists the folders in a folder, not the folder itself or others", async () => {
    withRows(
      [
        { dir_path: "Goa", file_count: 3, total_size: 30, media_count: 3 },
        {
          dir_path: "Goa/Beach",
          file_count: 5,
          total_size: 50,
          media_count: 1,
        },
        {
          dir_path: "Goa/Beach/Day 1",
          file_count: 1,
          total_size: 1,
          media_count: 1,
        },
        { dir_path: "Goal", file_count: 1, total_size: 1, media_count: 1 },
      ],
      ["Goa/Food"],
    );
    expect(await loadDb().getChildFolders("Goa")).toEqual({
      ok: true,
      value: [
        {
          dirPath: "Goa/Beach",
          name: "Beach",
          fileCount: 6,
          totalSize: 51,
          mediaCount: 2,
        },
        {
          dirPath: "Goa/Food",
          name: "Food",
          fileCount: 0,
          totalSize: 0,
          mediaCount: 0,
        },
      ],
    });
  });

  it("shows a local folder with no file once, with zero counts", async () => {
    withRows(
      [{ dir_path: "Goa", file_count: 1, total_size: 9, media_count: 1 }],
      ["New", "Goa", "New/Inner"],
    );
    const r = await loadDb().getChildFolders("");
    expect(r.ok && r.value.map((f) => [f.name, f.fileCount])).toEqual([
      ["Goa", 1],
      ["New", 0],
    ]);
  });
});

describe("addLocalDir", () => {
  it("adds a new folder", async () => {
    const { db } = fakeDb(LATEST);
    openMock.mockResolvedValue(db);
    expect(await loadDb().addLocalDir("Goa 2024")).toEqual({
      ok: true,
      value: "added",
    });
    const insert = db.runAsync.mock.calls.find((c) =>
      c[0].startsWith("INSERT INTO local_dir"),
    );
    expect(insert?.[1]).toBe("Goa 2024");
  });

  it("gives exists when a file or a local folder has the path", async () => {
    const { db } = fakeDb(LATEST);
    db.getFirstAsync.mockImplementation(async (sql: string) =>
      sql === "PRAGMA user_version" ? { user_version: LATEST } : { 1: 1 },
    );
    openMock.mockResolvedValue(db);
    expect(await loadDb().addLocalDir("Goa")).toEqual({
      ok: true,
      value: "exists",
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
