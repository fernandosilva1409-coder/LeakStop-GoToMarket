import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function PoliticaPrivacidade() {
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
        <h1 className="text-3xl font-bold text-paper">Política de Privacidade</h1>
        <p className="mt-2 font-mono text-xs text-faint">Última atualização: 15 de agosto de 2026</p>

        <div className="mt-8 rounded-lg border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn-text">
          Rascunho de partida com dados fiscais provisórios — a atualizar com os dados definitivos antes do lançamento comercial, e a rever por um advogado.
        </div>

        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="text-base font-semibold text-paper">1. Responsável pelo tratamento</h2>
            <p className="mt-2">
              Fernando Miguel dos Santos Silva, empresário em nome individual, NIF [A PREENCHER], com morada
              fiscal em [A PREENCHER], é o responsável pelo tratamento dos dados pessoais recolhidos através do
              LeakStop. Contacto para questões de proteção de dados: [EMAIL A PREENCHER].
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">2. Que dados recolhemos</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong className="text-paper">Dados de conta:</strong> email e palavra-passe (a palavra-passe é gerida de forma encriptada pela Supabase, nunca vemos nem armazenamos a palavra-passe em texto simples).</li>
              <li><strong className="text-paper">Dados do restaurante:</strong> nome, moeda, menu, ingredientes, compras, vendas e custos fixos que introduz na aplicação.</li>
              <li><strong className="text-paper">Dados de faturação:</strong> a Stripe processa e armazena os dados do cartão de pagamento diretamente — o LeakStop nunca tem acesso ao número do cartão. Guardamos apenas o identificador de cliente e de subscrição da Stripe, e o estado da subscrição.</li>
              <li><strong className="text-paper">Dados técnicos:</strong> registos de acesso e erros gerados automaticamente pela infraestrutura (Supabase, Vercel), para efeitos de segurança e diagnóstico.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">3. Finalidade e base legal</h2>
            <p className="mt-2">
              Tratamos estes dados para prestar o serviço contratado (execução do contrato — art. 6.º/1/b do
              RGPD), para faturação e cumprimento de obrigações fiscais (obrigação legal — art. 6.º/1/c), e
              para comunicações de suporte relacionadas com a sua conta (interesse legítimo — art. 6.º/1/f).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">4. Com quem partilhamos os dados</h2>
            <p className="mt-2">Os seus dados são partilhados apenas com os subcontratantes necessários para operar o serviço:</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong className="text-paper">Supabase</strong> — base de dados e autenticação.</li>
              <li><strong className="text-paper">Stripe</strong> — processamento de pagamentos.</li>
              <li><strong className="text-paper">Vercel</strong> — alojamento da aplicação.</li>
            </ul>
            <p className="mt-2">
              Não vendemos nem partilhamos os seus dados com terceiros para fins de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">5. Transferências internacionais</h2>
            <p className="mt-2">
              Alguns destes subcontratantes podem processar dados fora do Espaço Económico Europeu. Nesses
              casos, a transferência é feita ao abrigo de Cláusulas Contratuais-Tipo aprovadas pela Comissão
              Europeia ou mecanismo equivalente.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">6. Prazo de conservação</h2>
            <p className="mt-2">
              Conservamos os seus dados enquanto a conta estiver ativa. Após o cancelamento da conta, os dados
              são conservados pelo prazo legal aplicável a obrigações fiscais e contabilísticas, findo o qual
              são eliminados ou anonimizados.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">7. Os seus direitos</h2>
            <p className="mt-2">
              Nos termos do RGPD, tem direito a aceder, retificar, apagar, limitar ou opor-se ao tratamento dos
              seus dados, e a portabilidade dos mesmos. Pode exercer estes direitos contactando
              [EMAIL A PREENCHER]. Tem também o direito de apresentar reclamação junto da Comissão Nacional de
              Proteção de Dados (CNPD).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">8. Segurança</h2>
            <p className="mt-2">
              O acesso aos dados de cada restaurante é isolado ao nível da base de dados através de Row Level
              Security — um utilizador só consegue ler ou escrever dados dos restaurantes a que pertence.
              Ligações à aplicação são feitas por HTTPS.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">9. Cookies</h2>
            <p className="mt-2">
              Usamos apenas cookies essenciais ao funcionamento da aplicação (manter a sessão autenticada). Não
              usamos cookies de publicidade ou rastreio de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">10. Alterações a esta política</h2>
            <p className="mt-2">
              Podemos atualizar esta política ocasionalmente. Alterações materiais serão comunicadas por email
              ou através de aviso no painel antes de entrarem em vigor.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-paper">11. Contacto</h2>
            <p className="mt-2">Para questões sobre esta política: [EMAIL A PREENCHER].</p>
          </section>
        </div>
      </main>
    </div>
  );
}
