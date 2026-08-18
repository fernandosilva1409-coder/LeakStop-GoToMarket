import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { detectLanguage } from "../lib/landingCopy";
import { getLegalCopy } from "../lib/legalCopy";
import LegalLayout from "../components/ui/LegalLayout";

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
    <LegalLayout lang={lang} backLabel={c.back} title={t.title} lastUpdated={c.lastUpdated}>
      <div className="mt-8 rounded-xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn-text">
        {c.draftWarning}
      </div>

      {c.translationNotice && (
        <div className="mt-3 rounded-xl bg-surface-sunken px-4 py-3 text-sm text-muted">
          {c.translationNotice}
        </div>
      )}

      <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted">
        {t.sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-base font-semibold text-heading">{section.title}</h2>
            {section.body?.map((p, i) => <p key={i} className="mt-2">{p}</p>)}
            {section.intro && <p className="mt-2">{section.intro}</p>}
            {section.items && (
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                {section.items.map(([label, text]) => (
                  <li key={label}><strong className="text-heading">{label}</strong>{section.itemSep || " "}{text}</li>
                ))}
              </ul>
            )}
            {section.outro && <p className="mt-2">{section.outro}</p>}
          </section>
        ))}
      </div>
    </LegalLayout>
  );
}
