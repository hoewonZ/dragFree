import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  migrateLegacyDragfreeDataIfNeeded,
  resolveDragfreeDataRoot
} from "../../src/main/app-data-root.js";

test("resolveDragfreeDataRoot uses portable dir when set", () => {
  const root = resolveDragfreeDataRoot({
    portableExecutableDir: "D:\\\\Apps\\\\dragFree",
    isPackaged: true,
    execPath: "D:\\\\Apps\\\\dragFree\\\\app.exe",
    userDataPath: "C:\\\\Users\\\\x\\\\AppData\\\\Roaming\\\\dragfree"
  });
  assert.equal(root, join("D:\\\\Apps\\\\dragFree", "config"));
});

test("resolveDragfreeDataRoot ignores packaged exe when portable dir set", () => {
  const root = resolveDragfreeDataRoot({
    portableExecutableDir: "E:\\\\portable",
    isPackaged: true,
    execPath: "C:\\\\Temp\\\\extract\\\\app.exe",
    userDataPath: "C:\\\\Users\\\\x\\\\AppData\\\\Roaming\\\\dragfree"
  });
  assert.equal(root, join("E:\\\\portable", "config"));
});

test("resolveDragfreeDataRoot uses dirname(execPath) when packaged and no portable", () => {
  const root = resolveDragfreeDataRoot({
    portableExecutableDir: "",
    isPackaged: true,
    execPath: "C:\\\\Program Files\\\\dragFree\\\\dragFree.exe",
    userDataPath: "C:\\\\Users\\\\x\\\\AppData\\\\Roaming\\\\dragfree"
  });
  assert.equal(root, join(dirname("C:\\\\Program Files\\\\dragFree\\\\dragFree.exe"), "config"));
});

test("resolveDragfreeDataRoot uses userData dragfree when not packaged", () => {
  const root = resolveDragfreeDataRoot({
    portableExecutableDir: "",
    isPackaged: false,
    execPath: "C:\\\\node_modules\\\\electron\\\\electron.exe",
    userDataPath: "C:\\\\Users\\\\x\\\\AppData\\\\Roaming\\\\Electron"
  });
  assert.equal(root, join("C:\\\\Users\\\\x\\\\AppData\\\\Roaming\\\\Electron", "dragfree"));
});

test("resolveDragfreeDataRoot trims portable executable dir", () => {
  const root = resolveDragfreeDataRoot({
    portableExecutableDir: "  D:\\\\p  ",
    isPackaged: true,
    execPath: "D:\\\\x.exe",
    userDataPath: "C:\\\\u"
  });
  assert.equal(root, join("D:\\\\p", "config"));
});

test("migrateLegacyDragfreeDataIfNeeded skips when new config.json exists", async () => {
  const base = await mkdtemp(join(tmpdir(), "dragfree-migrate-"));
  const newRoot = join(base, "new");
  const userData = join(base, "userdata");
  await mkdir(newRoot, { recursive: true });
  await writeFile(join(newRoot, "config.json"), "{}", "utf8");
  const legacy = join(userData, "dragfree");
  await mkdir(legacy, { recursive: true });
  await writeFile(join(legacy, "config.json"), '{"version":99}', "utf8");

  const result = await migrateLegacyDragfreeDataIfNeeded(newRoot, userData);
  assert.equal(result.migrated, false);
  assert.equal(result.reason, "new_config_exists");
  const still = await readFile(join(newRoot, "config.json"), "utf8");
  assert.equal(still, "{}");

  await rm(base, { recursive: true, force: true });
});

test("migrateLegacyDragfreeDataIfNeeded skips when no legacy config", async () => {
  const base = await mkdtemp(join(tmpdir(), "dragfree-migrate-"));
  const newRoot = join(base, "new");
  const userData = join(base, "userdata");

  const result = await migrateLegacyDragfreeDataIfNeeded(newRoot, userData);
  assert.equal(result.migrated, false);
  assert.equal(result.reason, "no_legacy");

  await rm(base, { recursive: true, force: true });
});

test("migrateLegacyDragfreeDataIfNeeded copies legacy tree when new config missing", async () => {
  const base = await mkdtemp(join(tmpdir(), "dragfree-migrate-"));
  const newRoot = join(base, "new");
  const userData = join(base, "userdata");
  const legacy = join(userData, "dragfree");
  await mkdir(join(legacy, "favorite-links"), { recursive: true });
  await writeFile(join(legacy, "config.json"), '{"version":1,"migrated":true}', "utf8");
  await writeFile(join(legacy, "favorite-links", "keep.txt"), "x", "utf8");

  const result = await migrateLegacyDragfreeDataIfNeeded(newRoot, userData);
  assert.equal(result.migrated, true);

  await access(join(newRoot, "config.json"), fsConstants.F_OK);
  const raw = await readFile(join(newRoot, "config.json"), "utf8");
  assert.match(raw, /"migrated":\s*true/);
  await access(join(newRoot, "favorite-links", "keep.txt"), fsConstants.F_OK);

  await rm(base, { recursive: true, force: true });
});
