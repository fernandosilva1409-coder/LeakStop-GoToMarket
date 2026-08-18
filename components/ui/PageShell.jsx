import DashboardNav from "../DashboardNav";

export default function PageShell({
  lang,
  children,
  contentClassName = "min-w-0 flex-1 overflow-x-auto",
  className = "mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8",
}) {
  return (
    <div className="flex min-h-screen bg-surface-bg">
      <DashboardNav lang={lang} />
      <div className={contentClassName}>
        <div className={className}>{children}</div>
      </div>
    </div>
  );
}
