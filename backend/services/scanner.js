import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { saveScans, getDirectories, getScans, saveGrowthHistory } from "./config.js";

const episodeRegex = /\bS(\d{1,2})E(\d{1,3})\b/i;

export async function scanDirectory(basePath, id) {
  const emptyResult = {
    totalSizeBytes: 0,
    filesystemId: "",
    filesystemTotalBytes: 0,
    filesystemUsedBytes: 0,
    filesystemAvailableBytes: 0,
    filesystemUsedPercent: 0,
    subDirs: []
  };

  function getFilesystemUsage(p) {
    try {
      // Use df first so values align with what users see on Linux servers.
      const raw = execSync(`df -B1 --output=source,size,used,avail,target "${p.replace(/"/g, '\\"')}"`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      const lines = raw.trim().split("\n");
      const dataLine = lines[lines.length - 1]?.trim() ?? "";
      const parts = dataLine.split(/\s+/);

      if (parts.length >= 5) {
        const source = String(parts[0] ?? "");
        const total = Number(parts[1] ?? 0);
        const used = Number(parts[2] ?? 0);
        const available = Number(parts[3] ?? 0);
        const usedPercent = total > 0 ? (used / total) * 100 : 0;

        return {
          filesystemId: source,
          filesystemTotalBytes: Number.isFinite(total) ? total : 0,
          filesystemUsedBytes: Number.isFinite(used) ? used : 0,
          filesystemAvailableBytes: Number.isFinite(available) ? available : 0,
          filesystemUsedPercent: Number.isFinite(usedPercent) ? usedPercent : 0
        };
      }
    } catch {
      // Fall back to statfs below.
    }

    try {
      const stats = fs.statfsSync(p);
      const blockSize = Number(stats.bsize || stats.frsize || 0);
      const totalBlocks = Number(stats.blocks || 0);
      const availableBlocks = Number(stats.bavail ?? stats.bfree ?? 0);

      const total = blockSize * totalBlocks;
      const available = blockSize * availableBlocks;
      const used = Math.max(0, total - available);
      const usedPercent = total > 0 ? (used / total) * 100 : 0;

      return {
        filesystemId: "",
        filesystemTotalBytes: Number.isFinite(total) ? total : 0,
        filesystemUsedBytes: Number.isFinite(used) ? used : 0,
        filesystemAvailableBytes: Number.isFinite(available) ? available : 0,
        filesystemUsedPercent: Number.isFinite(usedPercent) ? usedPercent : 0
      };
    } catch {
      return {
        filesystemId: "",
        filesystemTotalBytes: 0,
        filesystemUsedBytes: 0,
        filesystemAvailableBytes: 0,
        filesystemUsedPercent: 0
      };
    }
  }

  function scanNode(p) {
    const stats = fs.statSync(p);

    if (stats.isFile()) {
      const match = path.basename(p).match(episodeRegex);
      const seasons = new Set();
      const episodes = new Set();

      if (match) {
        const season = Number(match[1]);
        const episode = Number(match[2]);
        if (Number.isFinite(season)) seasons.add(season);
        if (Number.isFinite(season) && Number.isFinite(episode)) {
          episodes.add(`${season}x${episode}`);
        }
      }

      return {
        sizeBytes: stats.size,
        seasons,
        episodes
      };
    }

    const files = fs.readdirSync(p);
    return files.reduce(
      (acc, file) => {
        const child = scanNode(path.join(p, file));
        acc.sizeBytes += child.sizeBytes;
        child.seasons.forEach((s) => acc.seasons.add(s));
        child.episodes.forEach((e) => acc.episodes.add(e));
        return acc;
      },
      { sizeBytes: 0, seasons: new Set(), episodes: new Set() }
    );
  }

  try {
    const children = fs.readdirSync(basePath);
    const subDirs = [];
    const fsUsage = getFilesystemUsage(basePath);

    for (const name of children) {
      const full = path.join(basePath, name);
      if (fs.statSync(full).isDirectory()) {
        const data = scanNode(full);
        const isSeries = data.episodes.size > 0;
        subDirs.push({
          name,
          sizeBytes: data.sizeBytes,
          ...(isSeries
            ? {
                series: {
                  seasonCount: data.seasons.size,
                  episodeCount: data.episodes.size
                }
              }
            : {})
        });
      }
    }

    subDirs.sort((a, b) => b.sizeBytes - a.sizeBytes);

    const result = {
      totalSizeBytes: subDirs.reduce((a, b) => a + b.sizeBytes, 0),
      ...fsUsage,
      subDirs
    };

    await saveScans(id, result);
    try {
      const scans = await getScans();
      const totalLibrariesSize = Object.values(scans).reduce((sum, scan) => {
        return sum + Number(scan?.totalSizeBytes ?? 0);
      }, 0);
      await saveGrowthHistory({ ts: Date.now(), totalLibrariesSize });
    } catch {
      // Ignore growth snapshot failures so scans still succeed.
    }

    return result;
  } catch (error) {
    const result = {
      ...emptyResult,
      error: error instanceof Error ? error.message : "Scan failed"
    };

    await saveScans(id, result);
    return result;
  }
}

export async function fullScanAll() {
  const directories = await getDirectories();
  for (const dir of directories) {
    await scanDirectory(dir.path, dir.id);
  }
}