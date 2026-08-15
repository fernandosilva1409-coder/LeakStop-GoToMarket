# LeakStop — Arquitetura para a versão real (multi-restaurante)

## Stack escolhida

| Camada | Escolha | Porquê |
|---|---|---|
| Frontend + servidor | **Next.js** (React) | Reaproveita quase tudo o que já construímos no artefacto (mesmo React, mesmos componentes). API routes e páginas no mesmo projeto. Deploy trivial no Vercel. |
| Base de dados + autenticação | **Supabase** (Postgres) | Login (email/password, Google, etc.) e base de dados a sério, prontos a usar — poupa semanas vs. construir de raiz. Row Level Security (RLS) do Postgres garante que cada restaurante só vê os seus próprios dados. Tier gratuito generoso para começar. |
| Pagamentos | **Stripe** (Checkout + Customer Portal) | Página de pagamento já pronta e testada pela Stripe — não precisas de guardar cartões de crédito nem lidar com PCI compliance. Customer Portal deixa o cliente gerir a própria subscrição (cancelar, atualizar cartão) sem código extra. |
| Alojamento | **Vercel** | Deploy automático a cada `git push`. Combina naturalmente com Next.js (mesma empresa). |

## Porque não outra coisa

- **Firebase** seria alternativa válida a Supabase, mas Postgres (SQL) encaixa melhor no tipo de perguntas que já fazemos aos dados (agregações por categoria, por mês, por fornecedor) do que uma base NoSQL.
- **Construir autenticação/faturação do zero** — nunca compensa para uma MVP. É trabalho de semanas que não distingue o produto dos concorrentes.

## Como o código existente se encaixa

O ficheiro único `leakstop-app.jsx` que construímos tem duas partes muito diferentes, e isso importa para a migração:

1. **O motor de cálculo** (`computeAnalysis`, `computeRecommendations`, `classifyUnit`, `toBase`, etc.) — é puro JavaScript, sem React, sem `window.storage`. Este bloco **migra quase sem alterações** para `lib/calculations.js`. Já está testado com dados reais do Tás Cá Dentro.
2. **A interface (UI)** — os componentes React (`MenuTab`, `DashboardTab`, etc.) precisam de duas mudanças:
   - Troca de `window.storage` (exclusivo do ambiente Claude) por chamadas ao Supabase
   - Divisão do ficheiro único em páginas/rotas Next.js (`/dashboard`, `/menu`, `/purchases`, etc.) em vez de separadores dentro de uma só página — mais amigável para SEO e navegação normal de browser

## Multi-tenant: como isolar os dados de cada restaurante

Cada tabela tem uma coluna `restaurant_id`. As políticas de **Row Level Security** do Postgres garantem, ao nível da base de dados (não só no código), que um utilizador só consegue ler/escrever linhas do(s) restaurante(s) a que pertence — ver `supabase/schema.sql`.

## Faturação: fluxo básico

1. Restaurante regista-se → conta criada em estado `trialing` ou `inactive`
2. Ao subscrever, o browser é redirecionado para o Stripe Checkout (link seguro gerado pelo teu servidor)
3. Stripe notifica o teu servidor via **webhook** quando o pagamento é confirmado → atualizas `subscription_status` na tabela `restaurants`
4. O acesso ao dashboard verifica esse campo antes de mostrar dados

## O que falta para além disto (não incluído neste arranque)

- Importação de PDF de faturas (mencionado várias vezes na conversa como funcionalidade futura)
- Integração direta com sistemas de POS (Odoo, Toast, etc.)
- O produto de "inteligência de mercado" para fornecedores (mencionado no início da conversa)

## Próximos passos sugeridos no Claude Code

1. `npm install` neste projeto
2. Criar um projeto Supabase (grátis) e colar as credenciais no `.env.local`
3. Correr `supabase/schema.sql` no editor SQL do Supabase
4. Criar uma conta Stripe (modo teste) e colar as chaves no `.env.local`
5. `npm run dev` e testar o registo/login
6. Portar as restantes vistas (Menu, Purchases, Sales, Overhead, Recommendations) do artefacto original para páginas Next.js, usando `lib/calculations.js` como motor
