function formatBytes(bytes) {
  const value = Number(bytes ?? 0);
  if (value <= 0) return "0.00 GB";
  const gb = value / 1e9;
  if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
  return `${gb.toFixed(2)} GB`;
}

export default function BigList({ items, limit = 3 }) {
  const sliced = items.slice(0, limit);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {sliced.map((x, i) => (
        <div
          key={i}
          className="bg-[#151821] p-4 rounded-2xl border border-white/5 shadow-lg"
        >
          <h3 className="text-lg font-semibold">{x.name}</h3>
          <p className="text-purple-300 font-bold mt-1">
            {formatBytes(x.totalSizeBytes)}
          </p>
        </div>
      ))}
    </div>
  );
}