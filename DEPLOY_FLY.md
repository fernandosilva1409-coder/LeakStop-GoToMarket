# Deploy do LeakStop no Fly.io

Migração de Vercel → Fly.io. A base de dados e a autenticação continuam no
**Supabase** (não mudam). O Fly passa a correr apenas o servidor Next.js e as
API routes (`pages/api/*`), que são o backend da aplicação.

O que já está feito no código (nesta branch):

- `next.config.js` com `output: "standalone"` (imagem Docker enxuta)
- `Dockerfile` multi-stage (Node 20) + `.dockerignore`
- `fly.toml` (região `mad` — Madrid, UE)
- `/api/health` para o health check do Fly
- `@vercel/analytics` removido (`_app.js` + `package.json`)
- Texto legal: subprocessador de alojamento passou de Vercel para Fly.io (5 línguas)

Os passos abaixo envolvem credenciais, autenticação da CLI e ações
irreversíveis (domínio), por isso és **tu** que os corres.

---

## 0. Pré-requisitos (uma vez)

```bash
# instalar a CLI (macOS / Linux)
curl -L https://fly.io/install.sh | sh
fly auth login
```

## 1. Criar a app no Fly (sem fazer deploy ainda)

Na raiz do repositório:

```bash
fly launch --no-deploy --copy-config --name leakstop --region mad
```

- `--copy-config` usa o `fly.toml` que já está no repo.
- Se o nome `leakstop` estiver ocupado, escolhe outro e atualiza `app` no `fly.toml`.
- Diz **não** a criar base de dados Postgres/Redis — usamos o Supabase.

## 2. Definir os secrets (valores server-only)

Estes **nunca** entram na imagem. Tira os valores do teu `.env` atual do Vercel.

```bash
fly secrets set \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  STRIPE_SECRET_KEY="sk_live_ou_test_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  ANTHROPIC_API_KEY="sk-ant-..."
```

> `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
> `NEXT_PUBLIC_STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL` e
> `NEXT_PUBLIC_SITE_URL` são **públicos** (vão no bundle do browser) e entram
> no build como `--build-arg` (passo 3). A `anon key` do Supabase é pública
> por design.

## 3. Primeiro deploy

Passa os valores NEXT_PUBLIC_* como build-args (ajusta aos teus):

```bash
fly deploy \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ID="price_..." \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL="price_..." \
  --build-arg NEXT_PUBLIC_SITE_URL="https://leakstop.fly.dev"
```

Testa em `https://leakstop.fly.dev` (login, dashboard, chat de IA, tempo).
Nesta fase o Vercel ainda está vivo — nada em produção foi tocado.

## 4. Atualizar o webhook do Stripe

O webhook assina contra o `STRIPE_WEBHOOK_SECRET`, por isso o endpoint tem de
apontar para o Fly:

1. Stripe Dashboard → Developers → Webhooks.
2. Edita (ou cria) o endpoint para `https://<dominio>/api/stripe/webhook`.
3. Copia o novo **signing secret** e, se mudou, corre
   `fly secrets set STRIPE_WEBHOOK_SECRET="whsec_novo..."`.
4. Confirma que os eventos de subscrição (`checkout.session.completed`,
   `customer.subscription.*`) estão selecionados.

## 5. Domínio próprio

Quando estiveres confiante, aponta o domínio real:

```bash
fly certs add app.leakstop.com      # ou o domínio que usas
fly certs show app.leakstop.com     # mostra os registos DNS a criar
```

- Cria os registos A/AAAA/CNAME que o comando indicar, no teu DNS.
- Atualiza `NEXT_PUBLIC_SITE_URL` para o domínio final e volta a fazer `fly deploy`
  (o Stripe usa este valor para os redirects de checkout).
- Atualiza o endpoint do webhook do Stripe para o domínio final.

## 6. Desligar o Vercel

Só depois de o Fly estar a servir o domínio real e de validares pagamentos:

- No Supabase: Authentication → URL Configuration → mete o domínio do Fly nas
  **Redirect URLs** (e tira o do Vercel se já não for usado).
- Remove o projeto do Vercel ou desliga o domínio lá.

---

## Notas

- **Cron:** não há. A proposta meteorológica é gerada on-demand com cache, por
  isso não é preciso recriar nenhum cron job do Vercel.
- **Escala:** o `fly.toml` arranca com 1 máquina `shared-cpu-1x`/1GB e
  `auto_stop_machines = "suspend"`. Para 20 restaurantes chega com folga.
- **Logs:** `fly logs`. **Estado:** `fly status`. **Secrets:** `fly secrets list`.
- **Rollback:** `fly releases` + `fly deploy --image <release-anterior>` se preciso.
