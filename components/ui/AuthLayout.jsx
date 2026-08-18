import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function AuthLayout({ title, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-bg px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brass-light to-brass text-heading shadow-soft">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-heading">LeakStop</span>
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
