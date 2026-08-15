import Link from "next/link";
import { ChefHat, TrendingDown, UtensilsCrossed, Lightbulb, Check } from "lucide-react";

const FEATURES = [
  {
    icon: TrendingDown,
    title: "Desperdício sob controlo",
    description: "Compara o que compraste com o que vendeste e vê exatamente quanto dinheiro está a escapar por semana.",
  },
  {
    icon: UtensilsCrossed,
    title: "Custo real por prato",
    description: "Cada prato do menu, com o custo de ingredientes e overhead já incluído — sabes a margem real, não a estimada.",
  },
  {
    icon: Lightbulb,
    title: "Recomendações acionáveis",
    description: "Categorias com fraco desempenho, pratos a perder dinheiro — sinalizados automaticamente, sem folhas de cálculo.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-ink-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-ink-bg">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-paper">LeakStop</span>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/login" className="text-muted hover:text-paper">Entrar</Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brass px-4 py-2 font-semibold text-ink-bg hover:bg-brass-light"
          >
            Criar conta
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-12 text-center sm:pt-20">
        <h1 className="text-4xl font-bold tracking-tight text-paper sm:text-5xl">
          Encontra a fuga antes que te custe caro.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted">
          Desperdício, custo por prato e recomendações para o teu restaurante — tudo num único painel, atualizado com os teus dados reais.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-brass px-6 py-3 text-center font-semibold text-ink-bg hover:bg-brass-light sm:w-auto"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-ink-border2 px-6 py-3 text-center font-semibold text-paper hover:border-brass hover:text-brass sm:w-auto"
          >
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className="border-y border-ink-border bg-ink-panel/50">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
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

      <section className="mx-auto max-w-md px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-paper">Um preço, sem surpresas</h2>
        <div className="mt-6 rounded-2xl border border-ink-border bg-ink-panel p-8">
          <p className="font-mono text-4xl font-bold text-paper">
            49€<span className="text-base font-normal text-muted">/mês</span>
          </p>
          <p className="mt-1 text-sm text-faint">IVA incluído</p>
          <ul className="mt-6 space-y-2 text-left text-sm text-muted">
            {["Restaurantes ilimitados por conta", "Todos os painéis e recomendações", "Importação de menu por CSV"].map((item) => (
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
            Começar agora
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-border py-8 text-center text-sm text-faint">
        <p>LeakStop — feito para restaurantes portugueses.</p>
        <p className="mt-2 flex items-center justify-center gap-4">
          <Link href="/termos" className="hover:text-paper">Termos de Serviço</Link>
          <Link href="/politica-privacidade" className="hover:text-paper">Política de Privacidade</Link>
        </p>
      </footer>
    </div>
  );
}
