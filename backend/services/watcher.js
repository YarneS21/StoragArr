import chokidar from "chokidar";
import { scanDirectory } from "./scanner.js";
import { getDirectories } from "./config.js";

const watchers = new Map();

export function watchDirectory(dir) {
  if (!dir?.id || !dir?.path || watchers.has(dir.id)) return;

  const watcher = chokidar.watch(dir.path, {
    ignoreInitial: true,
    depth: 3
  });

  const rescan = () => scanDirectory(dir.path, dir.id).catch(() => {});

  watcher.on("add", rescan);
  watcher.on("unlink", rescan);
  watcher.on("addDir", rescan);
  watcher.on("unlinkDir", rescan);

  watchers.set(dir.id, watcher);
}

export async function unwatchDirectory(id) {
  const watcher = watchers.get(id);
  if (!watcher) return;

  await watcher.close();
  watchers.delete(id);
}

export async function initWatcher() {
  const dirs = await getDirectories();

  dirs.forEach(dir => watchDirectory(dir));
}