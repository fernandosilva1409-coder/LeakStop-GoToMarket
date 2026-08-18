import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { detectLanguage } from "../lib/landingCopy";
import { getLegalCopy } from "../lib/legalCopy";
import LegalLayout from "../components/ui/LegalLayout";

export default function Termos() {
  const router = useRouter();
  const [lang, setLang] = useState("pt");

  useEffect(() => {
    if (!router.isReady) return;
    setLang(detectLanguage(router.query));
  }, [router.isReady, router.query]);

  const legal = getLegalCopy(lang);
  const c = legal.common;
  const t = legal.terms;
  const privacyTitle = getLegalCopy(lang).privacy.title;

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
            {section.link && (
              <p className="mt-2">
                {section.link.pre}{" "}
                <Link href={`/politica-privacidade?lang=${lang}`} className="text-brass hover:text-brass-dark">{privacyTitle}</Link>
                {section.link.post}
              </p>
            )}
          </section>
        ))}
      </div>
    </LegalLayout>
  );
}
