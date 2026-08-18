export default function Card({ children, className = "", ...props }) {
  return (
    <div className={`rounded-2xl bg-surface-card p-5 shadow-soft ${className}`} {...props}>
      {children}
    </div>
  );
}
