# LeakStop — web app (arranque)

Ponto de partida para a versão real, multi-restaurante, do LeakStop. Ver `ARCHITECTURE.md`
para a explicação da stack e das decisões.

## O que já está aqui

- `lib/calculations.js` — o motor de cálculo completo (desperdício, custo por prato,
  margens, recomendações), **portado e verificado** contra os dados reais do
  Tás Cá Dentro. Já não precisa de ser reescrito, só reutilizado.
- `supabase/schema.sql` — esquema completo da base de dados, com Row Level Security
  para isolar os dados de cada restaurante.
- `pages/signup.js`, `pages/login.js` — autenticação básica.
- `pages/dashboard/index.js` — página funcional mínima que liga tudo (autenticação →
  Supabase → motor de cálculo → ecrã). Serve de modelo para as restantes páginas.
- `pages/api/stripe/checkout.js`, `pages/api/stripe/webhook.js` — fluxo de subscrição.

## O que falta construir (para o Claude Code)

1. Portar as restantes vistas do artefacto original (`leakstop-app.jsx`) para páginas
   Next.js, seguindo o padrão de `pages/dashboard/index.js`:
   - `/dashboard/menu` (com upload de CSV e edição de pratos)
   - `/dashboard/purchases`, `/dashboard/sales` (com paginação e pesquisa)
   - `/dashboard/overhead`
   - `/dashboard/recommendations`
2. Ecrã de "assinar agora" ligado a `pages/api/stripe/checkout.js`
3. Multi-idioma (o dicionário de traduções já existe no artefacto original — precisa
   de ser extraído para algo como `next-i18next` em vez do sistema `t()` manual)
4. Testes automáticos para `lib/calculations.js` (é a parte mais crítica — já está
   verificada manualmente, mas merece testes formais antes de teres clientes a pagar)

## Como arrancar

```bash
npm install
cp .env.example .env.local   # e preenche com as tuas credenciais reais
```

1. Cria um projeto em [supabase.com](https://supabase.com) (grátis)
2. Cola o URL e a "anon key" no `.env.local`
3. No editor SQL do Supabase, corre o conteúdo de `supabase/schema.sql`
4. Cria uma conta em [stripe.com](https://stripe.com), ativa o **modo de teste**,
   cria um produto recorrente de 49€/mês, e cola as chaves e o price ID no `.env.local`
5. `npm run dev` e abre `http://localhost:3000`

## Uma nota sobre os dados do Tás Cá Dentro

Os ficheiros CSV que já geraste (`TasCaDentro_menu_import.csv`, `_sales_import.csv`,
`_purchases_import.csv`) podem servir de dados de teste reais para validar esta
migração — importa-os para as tabelas `dishes`/`dish_ingredients`, `sales`, e `purchases`
de um restaurante de teste, e confirma que os números no dashboard coincidem com os
que já viste no artefacto original.
