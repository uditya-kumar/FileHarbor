import { openDatabaseAsync } from "expo-sqlite";

import type { IndexedFile } from "@/types/domain";

jest.mock("expo-sqlite", () => ({ openDatabaseAsync: jest.fn() }));

type DbModule = typeof import("@/index/db");

const openMock = openDatabaseAsync as jest.Mock;

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
    runAsync: jest.fn(async (_sql: string) => undefined),
    getFirstAsync: jest.fn(async () => ({ user_version: userVersion })),
    getAllAsync: jest.fn(async (_sql: string, ..._params: unknown[]): Promise<object[]> => [
      { message_id: 9, dir_path: "0/a", name: "x.png", date: 5 },
    ]),
    prepareAsync: jest.fn(async () => statement),
    withExclusiveTransactionAsync: jest.fn(async (task: (tx: unknown) => Promise<void>) => {
      await task(db);
    }),
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

afterEach(() => openMock.mockReset());

describe("db", () => {
  it("creates dir_index on a new database", async () => {
    const { db } = fakeDb(0);
    openMock.mockResolvedValue(db);
    await loadDb().getFilesInDir("0");
    const sql = db.execAsync.mock.calls.map((c) => c[0]).join("\n");
    expect(sql).toContain("CREATE TABLE dir_index");
    expect(sql).toContain("CREATE INDEX idx_dir ON dir_index(dir_path)");
    expect(sql).toContain("PRAGMA user_version = 1");
  });

  it("does not migrate an up-to-date database", async () => {
    const { db } = fakeDb(1);
    openMock.mockResolvedValue(db);
    await loadDb().getFilesInDir("0");
    expect(db.withExclusiveTransactionAsync).not.toHaveBeenCalled();
  });

  it("opens the database once", async () => {
    const { db } = fakeDb(1);
    openMock.mockResolvedValue(db);
    const mod = loadDb();
    await Promise.all([mod.getFilesInDir("0"), mod.getFilesInDir("0/a")]);
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it("replaces all rows in one transaction", async () => {
    const { db, statement, executed } = fakeDb(1);
    openMock.mockResolvedValue(db);
    const files: IndexedFile[] = [
      { messageId: 1, dirPath: "0", name: "a.jpg", date: 10 },
      { messageId: 2, dirPath: "0/b", name: "b.mp4", date: 11 },
    ];
    expect(await loadDb().replaceDirIndex(files)).toEqual({ ok: true, value: undefined });
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledWith("DELETE FROM dir_index");
    expect(executed).toEqual([
      [1, "0", "a.jpg", 10],
      [2, "0/b", "b.mp4", 11],
    ]);
    expect(statement.finalizeAsync).toHaveBeenCalled();
  });

  it("maps rows to IndexedFile", async () => {
    const { db } = fakeDb(1);
    openMock.mockResolvedValue(db);
    expect(await loadDb().getFilesInDir("0/a")).toEqual({
      ok: true,
      value: [{ messageId: 9, dirPath: "0/a", name: "x.png", date: 5 }],
    });
    expect(db.getAllAsync.mock.calls[0][1]).toBe("0/a");
  });

  it("gives an open error as a result, and tries again on the next call", async () => {
    const { db } = fakeDb(1);
    openMock.mockRejectedValueOnce(new Error("cannot open")).mockResolvedValue(db);
    const mod = loadDb();
    expect(await mod.getFilesInDir("0")).toEqual({ ok: false, message: "cannot open" });
    expect((await mod.getFilesInDir("0")).ok).toBe(true);
  });
});

describe("getDirSummaries", () => {
  it("maps the grouped rows", async () => {
    const { db } = fakeDb(1);
    db.getAllAsync.mockResolvedValueOnce([
      { dir_path: "0", file_count: 3 },
      { dir_path: "0/a", file_count: 146 },
    ]);
    openMock.mockResolvedValue(db);
    expect(await loadDb().getDirSummaries()).toEqual({
      ok: true,
      value: [
        { dirPath: "0", fileCount: 3 },
        { dirPath: "0/a", fileCount: 146 },
      ],
    });
    expect(db.getAllAsync.mock.calls[0][0]).toContain("GROUP BY dir_path");
  });
});
