import { getDirectories, getScans, getGrowthHistory } from "../services/config.js";
import { scanDirectory } from "../services/scanner.js";

export default async function (fastify) {
  function normalizeScan(scan) {
    const data = scan ?? {};
    return {
      totalSizeBytes: Number(data.totalSizeBytes ?? 0),
      filesystemId: String(data.filesystemId ?? ""),
      filesystemTotalBytes: Number(data.filesystemTotalBytes ?? 0),
      filesystemUsedBytes: Number(data.filesystemUsedBytes ?? 0),
      filesystemAvailableBytes: Number(data.filesystemAvailableBytes ?? 0),
      filesystemUsedPercent: Number(data.filesystemUsedPercent ?? 0),
      subDirs: Array.isArray(data.subDirs) ? data.subDirs : []
    };
  }

  fastify.get("/directories", async () => {
    return await getDirectories();
  });

  fastify.get("/growth-history", async () => {
    const growth = await getGrowthHistory();
    return Array.isArray(growth) ? growth : [];
  });

  fastify.get("/scan/:id", async (req) => {
    const id = req.params.id;
    const refresh = String(req.query?.refresh ?? "").toLowerCase();

    try {
      if (refresh === "1" || refresh === "true") {
        const dirs = await getDirectories();
        const dir = dirs.find((x) => x.id === id);
        if (dir) {
          const fresh = await scanDirectory(dir.path, dir.id);
          return normalizeScan(fresh);
        }
      }

      const scans = await getScans();
      return normalizeScan(scans[id]);
    } catch {
      return normalizeScan(null);
    }
  });
}