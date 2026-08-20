import { useRestaurant } from "../../lib/useRestaurant";
import { useDetectedLanguage } from "../../lib/landingCopy";
import { getDashCopy } from "../../lib/dashboardCopy";
import { CHANGELOG } from "../../lib/changelog";
import PageShell from "../../components/ui/PageShell";
import Card from "../../components/ui/Card";

export default function ChangelogPage() {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useRestaurant();

  const browserLang = useDetectedLanguage();
  const lang = restaurant?.language || browserLang;
  const dash = getDashCopy(lang);
  const t = dash.changelog;

  if (restaurantLoading) return <p className="p-10 text-muted">{dash.common.loading}</p>;
  if (restaurantError) return <p className="p-10 text-danger-text">{restaurantError}</p>;

  return (
    <PageShell lang={lang} className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-heading">{t.title}</h1>
      <p className="mt-1 text-sm text-muted">{t.subtitle}</p>

      <div className="mt-6 space-y-4">
        {CHANGELOG.map((release) => (
          <Card key={release.version}>
            <div className="flex items-baseline gap-3">
              <span className="rounded-full bg-gradient-to-br from-brass-light to-brass px-2.5 py-0.5 font-mono text-xs font-bold text-heading">
                v{release.version}
              </span>
              <span className="font-mono text-xs text-muted">{release.date}</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-heading">
              {release.entries.map((entry, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brass">–</span>
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
