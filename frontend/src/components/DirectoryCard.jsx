import { Link } from "react-router-dom";

function formatBytes(bytes) {
  const value = Number(bytes ?? 0);
  if (value <= 0) return "0.00 GB";
  const gb = value / 1e9;
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
}

export default function DirectoryCard({ dir }) {
  const usedPercent = Math.min(100, Math.max(0, Number(dir.filesystemUsedPercent ?? 0)));
  const totalFs = Number(dir.filesystemTotalBytes ?? 0);
  const usedFs = Number(dir.filesystemUsedBytes ?? 0);
  const librarySize = Number(dir.totalSizeBytes ?? 0);

  return (
    <Link
      to={`/dir/${dir.id}`}
      className="bg-[#151821] p-4 rounded-2xl hover:bg-[#1e2230] transition shadow-lg border border-white/5"
    >
      <div
        className="h-2 w-full rounded mb-3"
        style={{ background: dir.color }}
      />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold">{dir.name}</h3>
        <span className="text-sm font-semibold text-purple-300 whitespace-nowrap">
          {formatBytes(librarySize)}
        </span>
      </div>
      <p className="text-gray-400 text-sm">{dir.path}</p>

      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-300 mb-1">
          <span>Disk used: {usedPercent.toFixed(1)}%</span>
          <span>{formatBytes(usedFs)} / {formatBytes(totalFs)}</span>
        </div>
        <div className="h-2 w-full bg-white/10 rounded">
          <div
            className="h-2 rounded bg-red-500"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}