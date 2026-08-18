export default function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="mt-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-border">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brass-light to-brass transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted">{current} / {total} · {pct}%</p>
    </div>
  );
}
