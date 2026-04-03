import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * 与 config.json 同级的 favorite-links 目录（存放指向常用文件夹的 .lnk，仅 Windows 生成）。
 */
export function getFavoriteLinksDir(configFilePath) {
  return join(dirname(configFilePath), "favorite-links");
}

function sanitizeLnkBaseName(name, index) {
  const cleaned = String(name || "folder")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .trim()
    .slice(0, 120);
  return cleaned || `folder-${index}`;
}

async function createWindowsShortcut(lnkPath, targetPath) {
  const escLnk = lnkPath.replace(/'/g, "''");
  const escTarget = targetPath.replace(/'/g, "''");
  const ps = `$w = New-Object -ComObject WScript.Shell; $s = $w.CreateShortcut('${escLnk}'); $s.TargetPath = '${escTarget}'; $s.Save()`;
  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, timeout: 20000 }
  );
}

/**
 * 根据配置中的常用文件夹，在 favorite-links 下重建 .lnk（仅 Windows）。
 * @param {{ configFilePath: string; folders: unknown }} options
 */
export async function syncFavoriteLinkShortcuts(options) {
  const { configFilePath, folders } = options;
  const dir = getFavoriteLinksDir(configFilePath);
  await mkdir(dir, { recursive: true });

  if (process.platform !== "win32") {
    return { ok: true, skipped: true, dir };
  }

  let entries = [];
  try {
    entries = await readdir(dir);
  } catch {
    entries = [];
  }
  for (const name of entries) {
    if (name.toLowerCase().endsWith(".lnk")) {
      await unlink(join(dir, name)).catch(() => {});
    }
  }

  const list = Array.isArray(folders) ? folders : [];
  const usedNames = new Set();
  let index = 0;

  for (const item of list) {
    if (!item || typeof item !== "object") {
      index += 1;
      continue;
    }
    const targetPath = typeof item.path === "string" ? item.path.trim() : "";
    if (!targetPath) {
      index += 1;
      continue;
    }
    try {
      await access(targetPath, fsConstants.F_OK);
    } catch {
      index += 1;
      continue;
    }

    const rawName = typeof item.name === "string" && item.name.trim() ? item.name.trim() : targetPath;
    let base = sanitizeLnkBaseName(rawName, index);
    let candidate = `${base}.lnk`;
    let n = 2;
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${base} (${n}).lnk`;
      n += 1;
    }
    usedNames.add(candidate.toLowerCase());

    const lnkPath = join(dir, candidate);
    try {
      await createWindowsShortcut(lnkPath, targetPath);
    } catch (error) {
      console.warn(
        "[dragFree] favorite-links: failed to create shortcut",
        lnkPath,
        error instanceof Error ? error.message : error
      );
    }
    index += 1;
  }

  return { ok: true, skipped: false, dir };
}
