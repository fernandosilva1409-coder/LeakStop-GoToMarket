const BADGE_TONE = {
  neutral: "bg-surface-sunken text-heading",
  good: "bg-good/10 text-good",
  danger: "bg-danger-bg text-danger-text",
};

export default function StatCard({ icon: Icon, label, value, tone = "neutral" }) {
  return (
    <div className="rounded-2xl bg-surface-card p-5 shadow-soft">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${BADGE_TONE[tone] || BADGE_TONE.neutral}`}>
            <Icon size={18} />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-0.5 font-mono text-2xl font-bold text-heading">{value}</p>
        </div>
      </div>
    </div>
  );
}
