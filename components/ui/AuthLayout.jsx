import Link from "next/link";
import Logo from "./Logo";

export default function AuthLayout({ title, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-bg px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-3">
          <Logo size="lg" />
          <span className="text-xl font-bold text-heading">LeakStop</span>
        </Link>
        <div className="rounded-2xl bg-surface-card p-8 shadow-soft-md">
          <h1 className="text-xl font-semibold text-heading">{title}</h1>
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}
