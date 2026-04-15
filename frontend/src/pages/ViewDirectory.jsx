import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

function formatBytes(bytes) {
  const value = Number(bytes ?? 0);
  if (value <= 0) return "0.00 GB";
  const gb = value / 1e9;
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
}

function medalForRank(rank) {
  if (rank === 0) return { label: "1", color: "#f59e0b", text: "#111827" };
  if (rank === 1) return { label: "2", color: "#94a3b8", text: "#0f172a" };
  if (rank === 2) return { label: "3", color: "#b45309", text: "#f8fafc" };
  return null;
}

function normalizeBloatName(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/i, "")
    .replace(/\b(2160p|1080p|720p|480p|4k|uhd|hdr|dv|dolby\s*vision|remux|web[-_. ]?dl|web[-_. ]?rip|bluray|bdrip|x264|x265|h264|h265|hevc|av1|ddp?|dts|truehd|atmos|proper|repack|extended|uncut)\b/gi, "")
    .replace(/[._-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBloatGroups(subDirs) {
  const groups = new Map();

  for (const dir of Array.isArray(subDirs) ? subDirs : []) {
    const normalized = normalizeBloatName(dir.name);
    if (!normalized) continue;

    const group = groups.get(normalized) ?? [];
    group.push(dir);
    groups.set(normalized, group);
  }

  return Array.from(groups.entries())
    .map(([title, items]) => {
      const sorted = [...items].sort((a, b) => Number(b.sizeBytes ?? 0) - Number(a.sizeBytes ?? 0));
      const totalBytes = sorted.reduce((sum, item) => sum + Number(item.sizeBytes ?? 0), 0);
      const wastedBytes = sorted.slice(1).reduce((sum, item) => sum + Number(item.sizeBytes ?? 0), 0);
      return {
        title,
        items: sorted,
        totalBytes,
        wastedBytes
      };
    })
    .filter((group) => group.items.length > 1)
    .sort((a, b) => b.wastedBytes - a.wastedBytes);
}

export default function ViewDirectory() {
  const { id } = useParams();
  const [scan, setScan] = useState({
    totalSizeBytes: 0,
    filesystemTotalBytes: 0,
    filesystemUsedBytes: 0,
    filesystemAvailableBytes: 0,
    filesystemUsedPercent: 0,
    subDirs: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load(true);
  }, [id]);

  async function load(forceRefresh = false) {
    if (loading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const res = await api.get(`/public/scan/${id}${forceRefresh ? "?refresh=1" : ""}`);
    const data = res.data ?? {};
    setScan({
      totalSizeBytes: Number(data.totalSizeBytes ?? 0),
      filesystemTotalBytes: Number(data.filesystemTotalBytes ?? 0),
      filesystemUsedBytes: Number(data.filesystemUsedBytes ?? 0),
      filesystemAvailableBytes: Number(data.filesystemAvailableBytes ?? 0),
      filesystemUsedPercent: Number(data.filesystemUsedPercent ?? 0),
      subDirs: Array.isArray(data.subDirs) ? data.subDirs : []
    });
    setLoading(false);
    setRefreshing(false);
  }

  if (loading) return <p>Loading...</p>;

  const filtered = scan.subDirs.filter((x) =>
    x.name.toLowerCase().includes(search.toLowerCase())
  );
  const bloatGroups = buildBloatGroups(scan.subDirs);
  const bloatBytes = bloatGroups.reduce((sum, group) => sum + group.wastedBytes, 0);
  const usedPercent = Math.min(100, Math.max(0, Number(scan.filesystemUsedPercent ?? 0)));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-3xl font-bold">Directory Contents</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      <div className="bg-[#151821] rounded-2xl border border-white/5 p-4 mb-6">
        <div className="flex flex-wrap gap-4 text-sm mb-3">
          <p className="text-gray-200">Used: {formatBytes(scan.filesystemUsedBytes)}</p>
          <p className="text-gray-200">Total: {formatBytes(scan.filesystemTotalBytes)}</p>
          <p className="text-gray-200">Available: {formatBytes(scan.filesystemAvailableBytes)}</p>
          <p className="text-red-300 font-semibold">{usedPercent.toFixed(1)}% used</p>
        </div>
        <div className="h-3 w-full bg-white/10 rounded">
          <div className="h-3 rounded bg-red-500" style={{ width: `${usedPercent}%` }} />
        </div>
      </div>

      <div className="bg-[#151821] rounded-2xl border border-white/5 p-4 mb-6 shadow-lg">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-lg font-semibold">Bloat Detection</h2>
          <span className="text-sm text-gray-300">Potential bloat: {formatBytes(bloatBytes)}</span>
        </div>
        {bloatGroups.length === 0 ? (
          <p className="text-gray-400 text-sm">No obvious duplicate movie folders detected yet.</p>
        ) : (
          <div className="space-y-3">
            {bloatGroups.slice(0, 8).map((group) => (
              <div key={group.title} className="rounded-xl border border-white/5 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-semibold capitalize">{group.title}</h3>
                    <p className="text-xs text-gray-400">
                      {group.items.length} copies • total {formatBytes(group.totalBytes)} • likely bloat {formatBytes(group.wastedBytes)}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Duplicate set
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span key={item.name} className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-300">
                      {item.name} ({formatBytes(item.sizeBytes)})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        placeholder="Search…"
        className="mb-4 px-3 py-2 rounded bg-black/20 border border-white/10 w-full"
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <p className="text-gray-400 mb-4">No scanned subdirectories yet.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.slice(0, 20).map((x, i) => (
          <div
            key={i}
            className="bg-[#151821] p-4 rounded-2xl shadow border border-white/5"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold">{x.name}</h3>
              {medalForRank(i) && (
                <span
                  className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                  style={{
                    background: medalForRank(i).color,
                    color: medalForRank(i).text
                  }}
                  title={`Rank ${i + 1}`}
                >
                  {medalForRank(i).label}
                </span>
              )}
            </div>
            <p className="text-purple-300 font-bold mt-1">
              {formatBytes(x.sizeBytes)}
            </p>
            {x.series && (
              <p className="text-gray-300 text-sm mt-2">
                {x.series.seasonCount} season{x.series.seasonCount === 1 ? "" : "s"} • {x.series.episodeCount} episode{x.series.episodeCount === 1 ? "" : "s"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}