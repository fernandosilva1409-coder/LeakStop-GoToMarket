const VARIANTS = {
  primary: "bg-gradient-to-br from-brass-light to-brass text-heading shadow-soft hover:shadow-soft-md hover:from-brass hover:to-brass-dark",
  secondary: "border border-surface-border bg-surface-card text-heading shadow-soft hover:border-brass hover:text-brass",
  ghost: "text-muted hover:bg-surface-sunken hover:text-heading",
};

export default function Button({ variant = "primary", icon: Icon, className = "", children, ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}
