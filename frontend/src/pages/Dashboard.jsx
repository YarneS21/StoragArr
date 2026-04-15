import { useEffect, useState } from "react";
import api from "../api";
import DirectoryCard from "../components/DirectoryCard";

const MAX_GROWTH_POINTS = 240;

function formatBytes(bytes) {
  const value = Number(bytes ?? 0);
  if (value <= 0) return "0.00 GB";
  const gb = value / 1e9;
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad)
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

function normalizeGrowthHistory(points) {
  return Array.isArray(points)
    ? points
        .map((x) => ({
          ts: Number(x.ts ?? 0),
          totalLibrariesSize: Number(x.totalLibrariesSize ?? 0)
        }))
        .filter((x) => Number.isFinite(x.ts) && x.ts > 0 && Number.isFinite(x.totalLibrariesSize) && x.totalLibrariesSize >= 0)
        .slice(-MAX_GROWTH_POINTS)
    : [];
}

function computeTotals(dirs) {
  const totalLibrariesSize = dirs.reduce((sum, d) => sum + Number(d.totalSizeBytes ?? 0), 0);

  const uniqueDisks = Array.from(
    dirs.reduce((map, d) => {
      const total = Number(d.filesystemTotalBytes ?? 0);
      const used = Number(d.filesystemUsedBytes ?? 0);
      const available = Number(d.filesystemAvailableBytes ?? 0);
      if (total <= 0 && used <= 0 && available <= 0) return map;

      const filesystemId = String(d.filesystemId ?? "").trim();
      const key = filesystemId || `${total}:${used}:${available}`;

      if (!map.has(key)) {
        map.set(key, {
          filesystemTotalBytes: total,
          filesystemUsedBytes: used,
          filesystemAvailableBytes: available
        });
      }

      return map;
    }, new Map()).values()
  );

  const totalFilesystemBytes = uniqueDisks.reduce((sum, d) => sum + Number(d.filesystemTotalBytes ?? 0), 0);
  const totalFilesystemUsed = uniqueDisks.reduce((sum, d) => sum + Number(d.filesystemUsedBytes ?? 0), 0);
  const totalFilesystemFree = Math.max(0, totalFilesystemBytes - totalFilesystemUsed);
  const otherUsed = Math.max(0, totalFilesystemUsed - totalLibrariesSize);

  return {
    totalLibrariesSize,
    totalFilesystemBytes,
    totalFilesystemUsed,
    totalFilesystemFree,
    otherUsed
  };
}

function computeGrowthStats(history, totalFilesystemFree) {
  if (!Array.isArray(history) || history.length < 2) {
    return {
      monthlyGrowthBytes: 0,
      daysToFull: null
    };
  }

  const points = history.slice(-60);
  const first = points[0];
  const last = points[points.length - 1];
  const ms = last.ts - first.ts;
  const days = ms / (1000 * 60 * 60 * 24);
  if (days <= 0) {
    return {
      monthlyGrowthBytes: 0,
      daysToFull: null
    };
  }

  const delta = last.totalLibrariesSize - first.totalLibrariesSize;
  const bytesPerDay = delta / days;
  const monthlyGrowthBytes = Math.max(0, bytesPerDay * 30);
  const daysToFull = bytesPerDay > 0 ? Math.max(0, totalFilesystemFree / bytesPerDay) : null;

  return {
    monthlyGrowthBytes,
    daysToFull: Number.isFinite(daysToFull) ? daysToFull : null
  };
}

function buildChartPath(points, width, height, padding) {
  if (!Array.isArray(points) || points.length === 0) return "";
  if (points.length === 1) {
    const y = height / 2;
    return `M ${padding} ${y} L ${width - padding} ${y}`;
  }

  const minValue = Math.min(...points.map((p) => p.totalLibrariesSize));
  const maxValue = Math.max(...points.map((p) => p.totalLibrariesSize));
  const range = Math.max(1, maxValue - minValue);

  return points
    .map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((p.totalLibrariesSize - minValue) / range) * (height - padding * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatChartDate(ts) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ts));
  } catch {
    return "";
  }
}

function buildChartGeometry(points, width, height, padding) {
  if (!Array.isArray(points) || points.length === 0) {
    return { path: "", dots: [] };
  }

  const minValue = Math.min(...points.map((p) => p.totalLibrariesSize));
  const maxValue = Math.max(...points.map((p) => p.totalLibrariesSize));
  const range = Math.max(1, maxValue - minValue);
  const dots = points.map((p, i) => {
    const x = points.length === 1 ? width / 2 : padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p.totalLibrariesSize - minValue) / range) * (height - padding * 2);
    return {
      ...p,
      x,
      y,
      value: p.totalLibrariesSize,
      label: formatChartDate(p.ts)
    };
  });

  return {
    path: dots.length > 0
      ? dots.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")
      : "",
    dots,
    minValue,
    maxValue
  };
}

function findNearestGrowthPoint(points, x, y) {
  if (!Array.isArray(points) || points.length === 0) return null;

  let closest = points[0];
  let bestDistance = Infinity;

  points.forEach((point) => {
    const dx = point.x - x;
    const dy = point.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      closest = point;
    }
  });

  return closest;
}

export default function Dashboard() {
  const [dirs, setDirs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [growthHistory, setGrowthHistory] = useState([]);
  const [hoveredGrowthPoint, setHoveredGrowthPoint] = useState(null);

  useEffect(() => {
    load(true);
  }, []);

  async function load(forceRefresh = false) {
    setRefreshing(true);
    const res = await api.get("/public/directories");
    const directories = Array.isArray(res.data) ? res.data : [];
    const scanData = await Promise.all(
      directories.map(async (d) => {
        try {
          const scan = await api.get(`/public/scan/${d.id}${forceRefresh ? "?refresh=1" : ""}`);
          const data = scan.data ?? {};
          return {
            id: d.id,
            name: d.name,
            totalSizeBytes: Number(data.totalSizeBytes ?? 0),
            filesystemId: String(data.filesystemId ?? ""),
            filesystemTotalBytes: Number(data.filesystemTotalBytes ?? 0),
            filesystemUsedBytes: Number(data.filesystemUsedBytes ?? 0),
            filesystemAvailableBytes: Number(data.filesystemAvailableBytes ?? 0),
            filesystemUsedPercent: Number(data.filesystemUsedPercent ?? 0)
          };
        } catch {
          return {
            id: d.id,
            name: d.name,
            totalSizeBytes: 0,
            filesystemId: "",
            filesystemTotalBytes: 0,
            filesystemUsedBytes: 0,
            filesystemAvailableBytes: 0,
            filesystemUsedPercent: 0
          };
        }
      })
    );

    const scanById = Object.fromEntries(scanData.map((x) => [x.id, x]));
    const enriched = directories.map((d) => ({
      ...d,
      ...(scanById[d.id] ?? {})
    }));
    setDirs(enriched);

    const growthRes = await api.get("/public/growth-history");
    setGrowthHistory(normalizeGrowthHistory(growthRes.data));

    setRefreshing(false);
  }

  const {
    totalLibrariesSize,
    totalFilesystemBytes,
    totalFilesystemUsed,
    totalFilesystemFree,
    otherUsed
  } = computeTotals(dirs);

  const alertRows = dirs
    .map((d, i) => {
      const realPct = Math.min(100, Math.max(0, Number(d.filesystemUsedPercent ?? 0)));
      return {
        id: d.id,
        name: d.name,
        pct: realPct
      };
    })
    .filter((x) => x.pct >= 85)
    .sort((a, b) => b.pct - a.pct);

  const growthStats = computeGrowthStats(growthHistory, totalFilesystemFree);
  const chartPoints = growthHistory.slice(-30);
  const chartGeometry = buildChartGeometry(chartPoints, 560, 220, 16);
  const growthSentence = growthStats.monthlyGrowthBytes > 0
    ? `Your current growth ${formatBytes(growthStats.monthlyGrowthBytes)} per month -> disk will be full in ~${growthStats.daysToFull ? Math.round(growthStats.daysToFull) : "?"} days.`
    : "Not enough growth data. Refresh a few times over time to show prediction.";

  const pieSlices = [
    ...dirs
      .filter((d) => Number(d.totalSizeBytes ?? 0) > 0)
      .map((d) => ({
        label: d.name,
        value: Number(d.totalSizeBytes ?? 0),
        color: d.color || "#14b8a6"
      })),
    { label: "Other", value: otherUsed, color: "#f59e0b" },
    { label: "Free", value: totalFilesystemFree, color: "#334155" }
  ].filter((x) => x.value > 0);

  const pieTotal = pieSlices.reduce((sum, x) => sum + x.value, 0);
  let runningAngle = 0;
  const renderedSlices = pieSlices.map((slice) => {
    const startAngle = runningAngle;
    const span = pieTotal > 0 ? (slice.value / pieTotal) * 360 : 0;
    const endAngle = runningAngle + span;
    runningAngle = endAngle;
    return { ...slice, startAngle, endAngle };
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-3xl font-bold">Storage Overview</h1>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
        >
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      <div className="bg-[#151821] rounded-2xl border border-white/5 p-4 mb-6 shadow-lg">
        <p className="text-sm text-amber-300 font-semibold">Growth Forecast</p>
        <p className="text-sm text-gray-200 mt-1">{growthSentence}</p>
      </div>

      {alertRows.length > 0 && (
        <div className="bg-[#2a1717] rounded-2xl border border-red-400/30 p-4 mb-6 shadow-lg">
          <p className="text-sm text-red-300 font-semibold mb-2">Storage Alerts (85%+)</p>
          <div className="space-y-2">
            {alertRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between text-sm">
                <span>{row.name}</span>
                <span className="text-red-300 font-semibold">{row.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#151821] rounded-2xl border border-white/5 p-4 mb-6 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-400">Total library accumulation</p>
          <p className="text-xl font-bold text-purple-300">{formatBytes(totalLibrariesSize)}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mb-3">Libraries</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {dirs.map((x) => (
          <DirectoryCard key={x.id} dir={x} />
        ))}
      </div>

      <h2 className="text-xl font-semibold mt-10 mb-3">Graphs</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#151821] rounded-2xl border border-white/5 p-4 shadow-lg lg:col-span-2">
          <h3 className="font-semibold mb-4">Library Growth Over Time</h3>
          {chartPoints.length < 2 ? (
            <p className="text-gray-400 text-sm">Not enough data points yet. Use refresh over time.</p>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <svg
                  viewBox="0 0 560 220"
                  className="w-full h-52 overflow-visible"
                  onMouseLeave={() => setHoveredGrowthPoint(null)}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const localX = ((e.clientX - rect.left) / rect.width) * 560;
                    const localY = ((e.clientY - rect.top) / rect.height) * 220;
                    setHoveredGrowthPoint(findNearestGrowthPoint(chartGeometry.dots, localX, localY));
                  }}
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const localX = ((e.clientX - rect.left) / rect.width) * 560;
                    const localY = ((e.clientY - rect.top) / rect.height) * 220;
                    setHoveredGrowthPoint(findNearestGrowthPoint(chartGeometry.dots, localX, localY));
                  }}
                >
                  <defs>
                    <linearGradient id="growthLineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>

                  <line x1="16" y1="16" x2="16" y2="204" stroke="#334155" strokeDasharray="4 4" />
                  <line x1="16" y1="204" x2="544" y2="204" stroke="#334155" strokeDasharray="4 4" />
                  <line x1="16" y1="110" x2="544" y2="110" stroke="#1f2937" strokeDasharray="4 4" />

                  <path d={chartGeometry.path} fill="none" stroke="url(#growthLineGradient)" strokeWidth="3" strokeLinecap="round" />

                  {chartGeometry.dots.map((point, index) => (
                    <g key={`${point.ts}-${index}`}>
                      <circle cx={point.x} cy={point.y} r="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                      <circle cx={point.x} cy={point.y} r="2.5" fill="#38bdf8" />
                    </g>
                  ))}

                  {hoveredGrowthPoint && (
                    <g pointerEvents="none">
                      <line x1={hoveredGrowthPoint.x} y1="16" x2={hoveredGrowthPoint.x} y2="204" stroke="#f8fafc" strokeDasharray="4 4" opacity="0.25" />
                      <rect x={Math.max(16, hoveredGrowthPoint.x - 16)} y="16" width="32" height="188" fill="#38bdf8" opacity="0.05" />
                      <line x1={hoveredGrowthPoint.x} y1="16" x2={hoveredGrowthPoint.x} y2="204" stroke="#f8fafc" strokeDasharray="4 4" opacity="0.35" />
                      <circle cx={hoveredGrowthPoint.x} cy={hoveredGrowthPoint.y} r="8" fill="none" stroke="#f8fafc" strokeWidth="2" opacity="0.65" />
                    </g>
                  )}
                </svg>

                {hoveredGrowthPoint && (
                  <div
                    className="absolute -translate-x-1/2 -translate-y-full pointer-events-none rounded-xl border border-white/10 bg-slate-950/95 px-3 py-2 shadow-xl text-xs text-white"
                    style={{
                      left: `${(hoveredGrowthPoint.x / 560) * 100}%`,
                      top: `${Math.max(0, ((hoveredGrowthPoint.y - 10) / 220) * 100)}%`
                    }}
                  >
                    <div className="font-semibold text-sky-300">{formatBytes(hoveredGrowthPoint.value)}</div>
                    <div className="text-gray-300">{hoveredGrowthPoint.label}</div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <span>{chartGeometry.dots[0] ? chartGeometry.dots[0].label : ""}</span>
                <span>{chartGeometry.dots[Math.floor(chartGeometry.dots.length / 2)] ? chartGeometry.dots[Math.floor(chartGeometry.dots.length / 2)].label : ""}</span>
                <span>{chartGeometry.dots[chartGeometry.dots.length - 1] ? chartGeometry.dots[chartGeometry.dots.length - 1].label : ""}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#151821] rounded-2xl border border-white/5 p-4 shadow-lg">
          <h3 className="font-semibold mb-4">Disk Usage % (from filesystem)</h3>
          <div className="space-y-3">
            {dirs.length === 0 && <p className="text-gray-400 text-sm">No libraries yet.</p>}
            {dirs.map((d) => {
              const pct = Math.min(100, Math.max(0, Number(d.filesystemUsedPercent ?? 0)));
              return (
                <div key={d.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{d.name}</span>
                    <span className="text-gray-300">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded">
                    <div
                      className="h-2 rounded bg-red-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#151821] rounded-2xl border border-white/5 p-4 shadow-lg">
          <h3 className="font-semibold mb-4">Storage Distribution</h3>
          {renderedSlices.length === 0 ? (
            <p className="text-gray-400 text-sm">No scan data yet.</p>
          ) : (
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <svg viewBox="0 0 220 220" className="w-56 h-56 shrink-0">
                <circle cx="110" cy="110" r="70" fill="none" stroke="#0f172a" strokeWidth="40" />
                {renderedSlices.map((slice) => (
                  <path
                    key={slice.label}
                    d={describeArc(110, 110, 70, slice.startAngle, slice.endAngle)}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth="40"
                    strokeLinecap="butt"
                  />
                ))}
                <circle cx="110" cy="110" r="48" fill="#111827" />
                <text x="110" y="104" textAnchor="middle" className="fill-gray-300 text-[10px]">Total</text>
                <text x="110" y="122" textAnchor="middle" className="fill-white text-[12px] font-semibold">
                  {formatBytes(totalFilesystemBytes)}
                </text>
              </svg>

              <div className="w-full space-y-2">
                {renderedSlices.map((slice) => {
                  const pct = pieTotal > 0 ? (slice.value / pieTotal) * 100 : 0;
                  return (
                    <div key={`${slice.label}-legend`} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: slice.color }}
                        />
                        <span className="truncate">{slice.label}</span>
                      </div>
                      <div className="text-right text-gray-300">
                        <span>{formatBytes(slice.value)}</span>
                        <span className="ml-2 text-xs text-gray-400">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}