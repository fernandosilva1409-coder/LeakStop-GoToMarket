import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { detectLanguage } from "../lib/landingCopy";
import { getLegalCopy } from "../lib/legalCopy";

export default function PoliticaPrivacidade() {
  const router = useRouter();
  const [lang, setLang] = useState("pt");

  useEffect(() => {
    if (!router.isReady) return;
    setLang(detectLanguage(router.query));
  }, [router.isReady, router.query]);

  const legal = getLegalCopy(lang);
  const c = legal.common;
  const t = legal.privacy;

  return (
    <div className="min-h-screen bg-ink-bg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href={`/?lang=${lang}`} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-ink-bg">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-paper">LeakStop</span>
        </Link>
        <Link href={`/?lang=${lang}`} className="text-sm text-muted hover:text-paper">{c.back}</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-bold text-paper">{t.title}</h1>
        <p className="mt-2 font-mono text-xs text-faint">{c.lastUpdated}</p>

        <div className="mt-8 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn-text">
          {c.draftWarning}
        </div>

        {c.translationNotice && (
          <div className="mt-3 rounded-lg border border-ink-border2 bg-ink-panel px-4 py-3 text-sm text-muted">
            {c.translationNotice}
          </div>
        )}

        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted">
          {t.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-base font-semibold text-paper">{section.title}</h2>
              {section.body?.map((p, i) => <p key={i} className="mt-2">{p}</p>)}
              {section.intro && <p className="mt-2">{section.intro}</p>}
              {section.items && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5">
                  {section.items.map(([label, text]) => (
                    <li key={label}><strong className="text-paper">{label}</strong>{section.itemSep || " "}{text}</li>
                  ))}
                </ul>
              )}
              {section.outro && <p className="mt-2">{section.outro}</p>}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
