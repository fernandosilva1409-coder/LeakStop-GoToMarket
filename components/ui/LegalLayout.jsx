import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function LegalLayout({ lang, backLabel, title, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href={`/?lang=${lang}`} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brass-light to-brass text-heading shadow-soft">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-heading">LeakStop</span>
        </Link>
        <Link href={`/?lang=${lang}`} className="text-sm text-muted hover:text-heading">{backLabel}</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-bold text-heading">{title}</h1>
        <p className="mt-2 font-mono text-xs text-muted">{lastUpdated}</p>
        {children}
      </main>
    </div>
  );
}
