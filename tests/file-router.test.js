import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { routeEntries } from "../src/main/file-router.js";

test("routeEntries invokes onProgress start and per entry", async () => {
  const base = await mkdtemp(join(tmpdir(), "dragfree-fr-"));
  const targetDir = join(base, "target");
  const f1 = join(base, "a.txt");
  const f2 = join(base, "b.txt");
  await writeFile(f1, "a");
  await writeFile(f2, "b");

  const phases = [];
  const result = await routeEntries({
    sourcePaths: [f1, f2],
    targetDirectory: targetDir,
    action: "copy",
    onProgress: (p) => {
      phases.push(p);
    }
  });

  assert.equal(result.status, "success");
  assert.equal(result.copiedCount, 2);
  assert.equal(phases[0].phase, "start");
  assert.equal(phases[0].total, 2);
  assert.equal(phases[1].phase, "entry-start");
  assert.equal(phases[1].index, 0);
  assert.equal(phases[2].phase, "entry-done");
  assert.equal(phases[2].completed, 1);
  assert.equal(phases[2].success, true);
  assert.equal(phases[3].phase, "entry-start");
  assert.equal(phases[3].index, 1);
  assert.equal(phases[4].phase, "entry-done");
  assert.equal(phases[4].completed, 2);

  await rm(base, { recursive: true, force: true });
});

test("routeEntries onProgress errors do not break routing", async () => {
  const base = await mkdtemp(join(tmpdir(), "dragfree-fr-"));
  const targetDir = join(base, "target");
  const f1 = join(base, "only.txt");
  await writeFile(f1, "x");

  const result = await routeEntries({
    sourcePaths: [f1],
    targetDirectory: targetDir,
    action: "copy",
    onProgress: () => {
      throw new Error("boom");
    }
  });

  assert.equal(result.status, "success");
  await rm(base, { recursive: true, force: true });
});
