import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ChefHat, Check, Pencil, Trash2, Wallet, Percent, Sparkles, MessageCircle, CloudSun } from "lucide-react";
import { COPY, LANGUAGES, detectLanguage } from "../lib/landingCopy";
import StatCard from "../components/ui/StatCard";

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

  const TOUR = [
    { title: t.tour1_title, desc: t.tour1_desc, mockup: <MenuMockup t={t} /> },
    { title: t.tour2_title, desc: t.tour2_desc, mockup: <PurchasesMockup t={t} /> },
    { title: t.tour3_title, desc: t.tour3_desc, mockup: <OverheadMockup t={t} /> },
    { title: t.tour4_title, desc: t.tour4_desc, mockup: <RecommendationsMockup t={t} /> },
    { title: t.tour5_title, desc: t.tour5_desc, mockup: <ChatMockup t={t} /> },
    { title: t.tour6_title, desc: t.tour6_desc, mockup: <WeatherMockup t={t} /> },
  ];

  const HOW_STEPS = [
    { title: t.how_step1_title, desc: t.how_step1_desc },
    { title: t.how_step2_title, desc: t.how_step2_desc },
    { title: t.how_step3_title, desc: t.how_step3_desc },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-surface-bg">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-gradient-to-br from-brass-light/30 to-brass/20 blur-3xl"
        />
      <header className="relative mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brass-light to-brass text-heading shadow-soft">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-heading">LeakStop</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 rounded-xl bg-surface-card p-0.5 shadow-soft">
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => changeLang(code)}
                className={`rounded-lg px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
                  lang === code ? "bg-gradient-to-br from-brass-light to-brass text-heading" : "text-muted hover:text-heading"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href={`/login?lang=${lang}`} className="text-muted hover:text-heading">{t.nav_login}</Link>
            <Link
              href={`/signup?lang=${lang}`}
              className="rounded-xl bg-gradient-to-br from-brass-light to-brass px-4 py-2 font-semibold text-heading shadow-soft hover:shadow-soft-md"
            >
              {t.nav_signup}
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-12 sm:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brass-light to-brass px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-heading shadow-soft">
              <ChefHat size={15} strokeWidth={2.4} /> {t.hero_eyebrow}
            </span>
            <h1 className="mt-6 text-5xl font-bold leading-[1.08] tracking-tight text-heading sm:text-6xl">
              {t.hero_title}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-xl leading-relaxed text-muted lg:mx-0">
              {t.hero_subtitle}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href={`/signup?lang=${lang}`}
                className="w-full rounded-xl bg-gradient-to-br from-brass-light to-brass px-7 py-3.5 text-center text-base font-semibold text-heading shadow-soft-md hover:shadow-soft-lg sm:w-auto"
              >
                {t.hero_cta_primary}
              </Link>
              <Link
                href={`/login?lang=${lang}`}
                className="w-full rounded-xl border border-surface-border bg-surface-card px-7 py-3.5 text-center text-base font-semibold text-heading shadow-soft hover:border-brass hover:text-brass sm:w-auto"
              >
                {t.hero_cta_secondary}
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-surface-card p-6 shadow-soft-lg">
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.example_eyebrow}</p>
            <p className="mt-1 text-base font-semibold text-heading">{t.example_title}</p>
            <div className="mt-5 grid grid-cols-1 gap-3">
              <StatCard icon={Wallet} label={t.example_kpi1_label} value="€12,480" tone="neutral" />
              <StatCard icon={Trash2} label={t.example_kpi2_label} value="€890" tone="danger" />
              <StatCard icon={Percent} label={t.example_kpi3_label} value="68%" tone="good" />
            </div>
            <p className="mt-4 text-center text-xs text-muted">{t.example_note}</p>
          </div>
        </div>
      </section>
      </div>

      <section className="bg-heading py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto flex max-w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <Sparkles size={14} className="text-brass-light" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-brass-light">{t.ai_badge}</span>
          </div>
          <h2 className="mt-5 text-center text-3xl font-bold text-white sm:text-4xl">{t.ai_title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-white/70">{t.ai_subtitle}</p>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brass-light to-brass text-heading">
                <MessageCircle size={18} strokeWidth={2.2} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{t.ai_chat_title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{t.ai_chat_desc}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brass-light to-brass text-heading">
                <CloudSun size={18} strokeWidth={2.2} />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-white">{t.ai_weather_title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{t.ai_weather_desc}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface-sunken py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold text-heading">{t.how_title}</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {HOW_STEPS.map((step, i) => (
              <div key={step.title} className="text-center sm:text-left">
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brass-light to-brass font-mono text-sm font-bold text-heading shadow-soft sm:mx-0">
                  {i + 1}
                </div>
                <h3 className="mt-3 font-semibold text-heading">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-center font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.tour_eyebrow}</p>
        <h2 className="mt-2 text-center text-2xl font-bold text-heading">{t.tour_title}</h2>
        <div className="mt-12 flex flex-col gap-16">
          {TOUR.map((item, i) => (
            <div key={item.title} className={`flex flex-col items-center gap-8 md:flex-row ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
              <div className="w-full md:w-1/2">{item.mockup}</div>
              <div className="w-full md:w-1/2">
                <h3 className="text-xl font-semibold text-heading">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-heading">{t.pricing_title}</h2>
        <div className="mt-6 rounded-2xl bg-surface-card p-8 shadow-soft-md">
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-brass">{t.pricing_trial}</p>
          <p className="mt-1 font-mono text-4xl font-bold text-heading">
            49€<span className="text-base font-normal text-muted">{t.pricing_period}</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-brass">{t.pricing_scope}</p>
          <p className="mt-1 text-sm text-muted">{t.pricing_vat}</p>
          <ul className="mt-6 space-y-2 text-left text-sm text-muted">
            {[t.pricing_feat1, t.pricing_feat2, t.pricing_feat3, t.pricing_feat4].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-good" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href={`/signup?lang=${lang}`}
            className="mt-8 block w-full rounded-xl bg-gradient-to-br from-brass-light to-brass px-6 py-3 text-center font-semibold text-heading shadow-soft hover:shadow-soft-md"
          >
            {t.pricing_cta}
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-muted">
        <p>{t.footer_tagline}</p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <Link href={`/termos?lang=${lang}`} className="hover:text-heading">{t.footer_terms}</Link>
          <Link href={`/politica-privacidade?lang=${lang}`} className="hover:text-heading">{t.footer_privacy}</Link>
        </p>
      </footer>
    </div>
  );
}

function MockupFrame({ children }) {
  return <div className="rounded-2xl bg-surface-card p-5 shadow-soft">{children}</div>;
}

function MenuMockup({ t }) {
  return (
    <MockupFrame>
      <div className="rounded-xl bg-surface-sunken p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-heading">{t.mockup_menu_dish}</p>
            <span className="mt-1 inline-block rounded-full bg-brass/10 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-brass">{t.mockup_menu_category}</span>
            <p className="mt-1.5 font-mono text-xs text-muted">{t.mockup_menu_meta}</p>
          </div>
          <div className="flex shrink-0 gap-1 text-muted">
            <Pencil size={14} />
            <Trash2 size={14} />
          </div>
        </div>
        <ul className="mt-3 space-y-0.5 border-t border-surface-border pt-3 font-mono text-[11.5px] text-muted">
          <li>{t.mockup_menu_ing1}</li>
          <li>{t.mockup_menu_ing2}</li>
          <li>{t.mockup_menu_ing3}</li>
        </ul>
      </div>
    </MockupFrame>
  );
}

function PurchasesMockup({ t }) {
  return (
    <MockupFrame>
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{t.mockup_purchases_ingredient}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[10px] uppercase text-muted">{t.mockup_purchases_bought}</p>
          <p className="mt-1 font-mono text-lg font-bold text-heading">12kg</p>
        </div>
        <div className="rounded-xl bg-surface-sunken p-3">
          <p className="font-mono text-[10px] uppercase text-muted">{t.mockup_purchases_used}</p>
          <p className="mt-1 font-mono text-lg font-bold text-heading">9.4kg</p>
        </div>
        <div className="rounded-xl bg-danger-bg p-3">
          <p className="font-mono text-[10px] uppercase text-danger-text/80">{t.mockup_purchases_waste}</p>
          <p className="mt-1 font-mono text-lg font-bold text-danger-text">2.6kg</p>
        </div>
      </div>
    </MockupFrame>
  );
}

function OverheadMockup({ t }) {
  const rows = [
    [t.mockup_overhead_rent, "800€"],
    [t.mockup_overhead_elec, "150€"],
    [t.mockup_overhead_labor, "2 400€"],
  ];
  return (
    <MockupFrame>
      <div className="space-y-2 font-mono text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-muted">
            <span>{label}</span>
            <span className="text-heading">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-surface-border pt-2 font-semibold text-brass">
          <span>{t.mockup_overhead_total}</span>
          <span>1.85€</span>
        </div>
      </div>
    </MockupFrame>
  );
}

function RecommendationsMockup({ t }) {
  const rows = [
    [t.mockup_rec_dish1, t.mockup_rec_class1, "bg-good/10 text-good"],
    [t.mockup_rec_dish2, t.mockup_rec_class2, "bg-brass/10 text-brass"],
    [t.mockup_rec_dish3, t.mockup_rec_class3, "bg-danger-bg text-danger-text"],
  ];
  return (
    <MockupFrame>
      <div className="space-y-2.5">
        {rows.map(([name, label, classes]) => (
          <div key={name} className="flex items-center justify-between gap-2">
            <span className="text-sm text-heading">{name}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>
          </div>
        ))}
      </div>
    </MockupFrame>
  );
}

function ChatMockup({ t }) {
  return (
    <MockupFrame>
      <div className="space-y-2">
        <div className="ml-auto max-w-[85%] rounded-2xl bg-gradient-to-br from-brass-light to-brass px-3.5 py-2 text-sm font-medium text-heading">
          {t.mockup_chat_question}
        </div>
        <div className="max-w-[85%] rounded-2xl bg-surface-sunken px-3.5 py-2 text-sm leading-relaxed text-heading">
          {t.mockup_chat_answer}
        </div>
      </div>
    </MockupFrame>
  );
}

function WeatherMockup({ t }) {
  return (
    <MockupFrame>
      <div className="rounded-xl bg-surface-sunken p-3.5">
        <div className="flex items-center gap-1.5 text-brass">
          <Sparkles size={13} />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wide">{t.mockup_weather_title}</span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {t.mockup_weather_desc}
        </p>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-sunken p-3.5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">{t.mockup_weather_date}</p>
          <p className="text-sm font-semibold text-heading">{t.mockup_weather_condition}</p>
        </div>
        <span className="rounded-full bg-good/10 px-2.5 py-1 font-mono text-xs font-semibold text-good">+18%</span>
      </div>
    </MockupFrame>
  );
}
