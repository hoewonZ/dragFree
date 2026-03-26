import { access, copyFile, cp, mkdir, rename, rm, stat } from "node:fs/promises";
import { join, parse } from "node:path";

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildConflictName(baseName, ext, index) {
  if (ext.length === 0) {
    return `${baseName} (${index})`;
  }
  return `${baseName} (${index})${ext}`;
}

export async function getUniqueTargetPath(targetDirectory, sourceName) {
  const parsed = parse(sourceName);
  const ext = parsed.ext;
  const baseName = ext.length > 0 ? sourceName.slice(0, -ext.length) : sourceName;

  let candidate = join(targetDirectory, sourceName);
  let index = 1;
  while (await pathExists(candidate)) {
    candidate = join(targetDirectory, buildConflictName(baseName, ext, index));
    index += 1;
  }

  return {
    path: candidate,
    renamed: index > 1
  };
}

async function copyEntry(sourcePath, targetPath, isDirectory) {
  if (isDirectory) {
    await cp(sourcePath, targetPath, { recursive: true, errorOnExist: false, force: true });
    return;
  }
  await copyFile(sourcePath, targetPath);
}

async function moveEntry(sourcePath, targetPath, isDirectory) {
  try {
    await rename(sourcePath, targetPath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "EXDEV") {
      await copyEntry(sourcePath, targetPath, isDirectory);
      if (isDirectory) {
        await rm(sourcePath, { recursive: true, force: true });
      } else {
        await rm(sourcePath, { force: true });
      }
      return;
    }
    throw error;
  }
}

export async function routeEntries({ sourcePaths, targetDirectory, action = "copy" }) {
  await mkdir(targetDirectory, { recursive: true });

  let copiedCount = 0;
  let movedCount = 0;
  let renamedCount = 0;
  const errors = [];

  for (const sourcePath of sourcePaths) {
    try {
      const sourceStat = await stat(sourcePath);
      const sourceName = sourcePath.split(/[/\\]/).filter(Boolean).pop() ?? sourcePath;
      const unique = await getUniqueTargetPath(targetDirectory, sourceName);

      if (unique.renamed) {
        renamedCount += 1;
      }

      if (action === "move") {
        await moveEntry(sourcePath, unique.path, sourceStat.isDirectory());
        movedCount += 1;
      } else {
        await copyEntry(sourcePath, unique.path, sourceStat.isDirectory());
        copiedCount += 1;
      }
    } catch (error) {
      errors.push({
        sourcePath,
        reason: error instanceof Error ? error.message : "unknown error"
      });
    }
  }

  let status = "success";
  if (sourcePaths.length === 0) {
    status = "cancelled";
  } else if (errors.length === sourcePaths.length) {
    status = "failed";
  } else if (errors.length > 0) {
    status = "partial-failed";
  }

  return {
    status,
    copiedCount,
    movedCount,
    renamedCount,
    errors
  };
}

export function inferAction(value) {
  return value === "move" ? "move" : "copy";
}
