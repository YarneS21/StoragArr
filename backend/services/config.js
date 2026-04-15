import fs from "fs-extra";

const USERS = "/config/users.json";
const DIRS = "/config/directories.json";
const SCANS = "/config/scans.json";
const GROWTH = "/config/growth.json";

let scansWriteQueue = Promise.resolve();

async function safeReadJson(file, fallback) {
  try {
    return await fs.readJson(file);
  } catch {
    try {
      const raw = await fs.readFile(file, "utf8");
      if (raw.trim()) {
        await fs.writeFile(`${file}.broken-${Date.now()}.json`, raw);
      }
    } catch {
      // Ignore backup failures and continue with fallback.
    }
    await fs.writeJson(file, fallback, { spaces: 2 });
    return fallback;
  }
}

export async function loadConfig() {
  await fs.ensureFile(USERS);
  await fs.ensureFile(DIRS);
  await fs.ensureFile(SCANS);
  await fs.ensureFile(GROWTH);

  if (!(await fs.readFile(USERS)).toString().trim()) await fs.writeJson(USERS, {});
  if (!(await fs.readFile(DIRS)).toString().trim()) await fs.writeJson(DIRS, []);
  if (!(await fs.readFile(SCANS)).toString().trim()) await fs.writeJson(SCANS, {});
  if (!(await fs.readFile(GROWTH)).toString().trim()) await fs.writeJson(GROWTH, []);
}

export async function getUsers() { return fs.readJson(USERS); }
export async function saveUsers(data) { return fs.writeJson(USERS, data, { spaces: 2 }); }

export async function getDirectories() { return fs.readJson(DIRS); }
export async function saveDirectories(data) { return fs.writeJson(DIRS, data, { spaces: 2 }); }

export async function getScans() { return safeReadJson(SCANS, {}); }
export async function saveScans(id, data) {
  scansWriteQueue = scansWriteQueue
    .catch(() => {})
    .then(async () => {
      const scans = await safeReadJson(SCANS, {});
      scans[id] = data;
      await fs.writeJson(SCANS, scans, { spaces: 2 });
    });

  return scansWriteQueue;
}

let growthWriteQueue = Promise.resolve();

export async function getGrowthHistory() { return safeReadJson(GROWTH, []); }

export async function saveGrowthHistory(point) {
  growthWriteQueue = growthWriteQueue
    .catch(() => {})
    .then(async () => {
      const growth = await safeReadJson(GROWTH, []);
      const nextPoint = {
        ts: Number(point?.ts ?? Date.now()),
        totalLibrariesSize: Number(point?.totalLibrariesSize ?? 0)
      };
      const last = growth[growth.length - 1];
      const minGapMs = 5 * 60 * 1000;

      if (last && nextPoint.ts - Number(last.ts ?? 0) < minGapMs) {
        growth[growth.length - 1] = nextPoint;
      } else {
        growth.push(nextPoint);
      }

      await fs.writeJson(GROWTH, growth.slice(-240), { spaces: 2 });
    });

  return growthWriteQueue;
}