export default function Field({ label, icon: Icon, hint, className = "", children }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          {Icon && <Icon size={13} />} {label}
        </span>
      )}
      {children}
      {hint && <span className="text-xs text-muted/80">{hint}</span>}
    </label>
  );
}
