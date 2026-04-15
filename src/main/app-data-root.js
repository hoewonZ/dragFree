import { constants as fsConstants } from "node:fs";
import { access, cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * 解析应用可写数据根目录（config.json、favorite-links、backgrounds、logs 的父目录）。
 * @param {{ portableExecutableDir?: string; isPackaged: boolean; execPath: string; userDataPath: string }} options
 */
export function resolveDragfreeDataRoot(options) {
  const portableDir = (options.portableExecutableDir ?? "").trim();
  if (portableDir) {
    return join(portableDir, "config");
  }
  if (options.isPackaged) {
    return join(dirname(options.execPath), "config");
  }
  return join(options.userDataPath, "dragfree");
}

/**
 * @param {{ isPackaged: boolean; getPath: (name: string) => string }} app
 */
export function resolveDragfreeDataRootFromApp(app) {
  return resolveDragfreeDataRoot({
    portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR,
    isPackaged: app.isPackaged,
    execPath: process.execPath,
    userDataPath: app.getPath("userData")
  });
}

/**
 * 若新目录尚无 config.json，且旧版 AppData/dragfree/config.json 存在，则整目录复制到新根目录。
 * @param {string} dragfreeDataRoot
 * @param {string} userDataPath
 */
export async function migrateLegacyDragfreeDataIfNeeded(dragfreeDataRoot, userDataPath) {
  const newConfigPath = join(dragfreeDataRoot, "config.json");
  try {
    await access(newConfigPath, fsConstants.F_OK);
    return { migrated: false, reason: "new_config_exists" };
  } catch {
    // continue
  }

  const legacyRoot = join(userDataPath, "dragfree");
  const legacyConfigPath = join(legacyRoot, "config.json");
  try {
    await access(legacyConfigPath, fsConstants.F_OK);
  } catch {
    return { migrated: false, reason: "no_legacy" };
  }

  try {
    await mkdir(dragfreeDataRoot, { recursive: true });
    await cp(legacyRoot, dragfreeDataRoot, { recursive: true });
    return { migrated: true };
  } catch (error) {
    console.warn(
      "[dragFree] migrate legacy data failed:",
      error instanceof Error ? error.message : error
    );
    return { migrated: false, reason: "error", error };
  }
}
