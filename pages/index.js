import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat, TrendingDown, UtensilsCrossed, Lightbulb, Check } from "lucide-react";
import { COPY, LANGUAGES, detectLanguage } from "../lib/landingCopy";

export default function Home() {
  const router = useRouter();
  const [lang, setLang] = useState("pt");

  useEffect(() => {
    if (!router.isReady) return;
    setLang(detectLanguage(router.query));
  }, [router.isReady, router.query]);

  const t = COPY[lang];

  const changeLang = (code) => {
    setLang(code);
    router.push({ pathname: "/", query: { lang: code } }, undefined, { shallow: true });
  };

  const FEATURES = [
    { icon: TrendingDown, title: t.feat1_title, description: t.feat1_desc },
    { icon: UtensilsCrossed, title: t.feat2_title, description: t.feat2_desc },
    { icon: Lightbulb, title: t.feat3_title, description: t.feat3_desc },
  ];

  const HOW_STEPS = [
    { title: t.how_step1_title, desc: t.how_step1_desc },
    { title: t.how_step2_title, desc: t.how_step2_desc },
    { title: t.how_step3_title, desc: t.how_step3_desc },
  ];

  return (
    <div className="min-h-screen bg-ink-bg">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-ink-bg">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-paper">LeakStop</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 rounded-lg border border-ink-border p-0.5">
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => changeLang(code)}
                className={`rounded-md px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                  lang === code ? "bg-brass text-ink-bg" : "text-muted hover:text-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-paper">{t.nav_login}</Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brass px-4 py-2 font-semibold text-ink-bg hover:bg-brass-light"
            >
              {t.nav_signup}
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-16 pt-12 text-center sm:pt-16">
        <h1 className="text-4xl font-bold tracking-tight text-paper sm:text-5xl">
          {t.hero_title}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          {t.hero_subtitle}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-brass px-6 py-3 text-center font-semibold text-ink-bg hover:bg-brass-light sm:w-auto"
          >
            {t.hero_cta_primary}
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-ink-border2 px-6 py-3 text-center font-semibold text-paper hover:border-brass hover:text-brass sm:w-auto"
          >
            {t.hero_cta_secondary}
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <p className="text-center font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.example_eyebrow}</p>
        <h2 className="mt-2 text-center text-2xl font-bold text-paper">{t.example_title}</h2>
        <div className="mt-6 rounded-xl border border-ink-border bg-ink-panel p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <ExampleKpi label={t.example_kpi1_label} value="€12,480" tone="neutral" />
            <ExampleKpi label={t.example_kpi2_label} value="€890" tone="danger" />
            <ExampleKpi label={t.example_kpi3_label} value="68%" tone="good" />
          </div>
          <p className="mt-4 text-center text-xs text-faint">{t.example_note}</p>
        </div>
      </section>

      <section className="border-y border-ink-border bg-ink-panel/50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold text-paper">{t.how_title}</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {HOW_STEPS.map((step, i) => (
              <div key={step.title} className="text-center sm:text-left">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brass font-mono text-sm font-bold text-ink-bg sm:mx-0">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-semibold text-paper">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-8 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-ink-border bg-ink-panel p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brass/10 text-brass">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 font-semibold text-paper">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-paper">{t.pricing_title}</h2>
        <div className="mt-6 rounded-2xl border border-ink-border bg-ink-panel p-8">
          <p className="font-mono text-4xl font-bold text-paper">
            49€<span className="text-base font-normal text-muted">{t.pricing_period}</span>
          </p>
          <p className="mt-1 text-sm text-faint">{t.pricing_vat}</p>
          <ul className="mt-6 space-y-2 text-left text-sm text-muted">
            {[t.pricing_feat1, t.pricing_feat2, t.pricing_feat3].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-good" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="mt-8 block w-full rounded-lg bg-brass px-6 py-3 text-center font-semibold text-ink-bg hover:bg-brass-light"
          >
            {t.pricing_cta}
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-border py-8 text-center text-sm text-faint">
        <p>{t.footer_tagline}</p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <Link href="/termos" className="hover:text-paper">{t.footer_terms}</Link>
          <Link href="/politica-privacidade" className="hover:text-paper">{t.footer_privacy}</Link>
        </p>
      </footer>
    </div>
  );
}

function ExampleKpi({ label, value, tone }) {
  const toneClasses = {
    neutral: "border-ink-border2 bg-ink-bg",
    good: "border-good/30 bg-good/5",
    danger: "border-danger-border bg-danger-bg",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${toneClasses}`}>
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 font-mono text-xl font-bold text-paper">{value}</p>
    </div>
  );
}
