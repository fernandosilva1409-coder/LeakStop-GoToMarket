import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function Termos() {
  return (
    <div className="min-h-screen bg-ink-bg">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass text-ink-bg">
            <ChefHat size={18} strokeWidth={2.2} />
          </div>
          <span className="text-lg font-bold text-paper">LeakStop</span>
        </Link>
        <Link href="/" className="text-sm text-muted hover:text-paper">← Voltar</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-20">
        <h1 className="text-3xl font-bold text-paper">Termos de Serviço</h1>
        <p className="mt-2 font-mono text-xs text-faint">Última atualização: 15 de agosto de 2026</p>

        <div className="mt-8 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn-text">
          Rascunho de partida com dados fiscais provisórios — a atualizar com os dados definitivos antes do lançamento comercial, e a rever por um advogado.
        </div>

        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="text-base font-semibold text-paper">1. Identificação do prestador de serviço</h2>
            <p className="mt-2">
              O serviço LeakStop é prestado por Fernando Miguel dos Santos Silva, empresário em nome individual,
              NIF [A PREENCHER], com morada fiscal em [A PREENCHER], doravante "LeakStop" ou "nós".
              Contacto: [EMAIL A PREENCHER].
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">2. Objeto do serviço</h2>
            <p className="mt-2">
              O LeakStop é uma aplicação web (SaaS) que permite a restaurantes registar o seu menu, compras,
              vendas e custos fixos, e obter análises de desperdício, margem por prato e recomendações de
              engenharia de menu com base nos dados introduzidos pelo próprio utilizador.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">3. Registo e conta</h2>
            <p className="mt-2">
              Para usar o LeakStop é necessário criar uma conta com email e palavra-passe. É responsável por
              manter a confidencialidade das suas credenciais e por toda a atividade realizada na sua conta.
              Deve fornecer informação verdadeira e mantê-la atualizada.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">4. Preço e faturação</h2>
            <p className="mt-2">
              O acesso ao LeakStop tem o custo de 49€/mês, IVA incluído, cobrado de forma recorrente através
              da Stripe. O pagamento é processado diretamente pela Stripe — o LeakStop não armazena dados de
              cartão. A fatura correspondente é emitida manualmente pelo prestador de serviço após cada
              cobrança.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">5. Duração e cancelamento</h2>
            <p className="mt-2">
              A subscrição é mensal, sem período de fidelização, e renova-se automaticamente até ser cancelada.
              Pode cancelar a qualquer momento através da opção "Gerir subscrição" no painel — o acesso
              mantém-se ativo até ao final do período já pago, sem reembolso proporcional.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">6. Obrigações do utilizador</h2>
            <p className="mt-2">
              Compromete-se a usar o LeakStop apenas para fins lícitos, a não partilhar as suas credenciais de
              acesso com terceiros não autorizados, e a não tentar aceder a dados de outros restaurantes ou
              contornar as medidas de segurança da aplicação.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">7. Limitação de responsabilidade</h2>
            <p className="mt-2">
              As análises, margens e recomendações apresentadas resultam de cálculos automáticos sobre os dados
              introduzidos pelo utilizador — a sua exatidão depende da exatidão desses dados. O LeakStop não se
              responsabiliza por decisões de gestão tomadas com base nestas análises, nem garante disponibilidade
              ininterrupta do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">8. Proteção de dados</h2>
            <p className="mt-2">
              O tratamento de dados pessoais está descrito na nossa{" "}
              <Link href="/politica-privacidade" className="text-brass hover:text-brass-light">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">9. Alterações aos termos</h2>
            <p className="mt-2">
              Podemos atualizar estes Termos ocasionalmente. Alterações materiais serão comunicadas por email
              ou através de aviso no painel antes de entrarem em vigor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">10. Lei aplicável</h2>
            <p className="mt-2">
              Estes Termos regem-se pela lei portuguesa. Para qualquer litígio, é competente o foro da comarca
              da morada fiscal do prestador de serviço, sem prejuízo dos direitos do consumidor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">11. Contacto</h2>
            <p className="mt-2">Para questões sobre estes Termos: [EMAIL A PREENCHER].</p>
          </section>
        </div>
      </main>
    </div>
  );
}
