# Self-hosted Supabase on Fly.io — deploy & migration runbook

Goal: move the LeakStop backend (database + auth) off Supabase's cloud onto a
self-hosted Supabase stack on Fly, so **Fly is the only provider**. The app
code does not change — only the env vars that point it at the backend.

The stack (`docker-compose.yml`) is **Postgres + Kong + GoTrue + PostgREST** —
no Storage, Realtime, or Studio, because LeakStop doesn't use them.

> The steps below provision infrastructure, set secrets, and migrate live data
> and user accounts. They need your Fly login and the current Supabase
> credentials, and the data/user migration is **irreversible** — so you run
> them. Each command is spelled out. Do a dry run against a throwaway Fly app
> first if you want a rehearsal.

---

## A. Generate the secrets (once)

```bash
# JWT secret (shared by Postgres, GoTrue, PostgREST, Kong)
openssl rand -base64 48

# From that secret, generate the ANON_KEY and SERVICE_ROLE_KEY JWTs.
# Easiest: Supabase's generator — https://supabase.com/docs/guides/self-hosting#api-keys
# (paste the JWT secret, copy the two keys). Or use any JWT tool with payloads:
#   anon:         {"role":"anon","iss":"supabase"}
#   service_role: {"role":"service_role","iss":"supabase"}

# Postgres password
openssl rand -base64 24
```

Fill these into `infra/supabase/.env` (copied from `.env.example`). Keep a copy
in your password manager — losing `JWT_SECRET` invalidates every session.

---

## B. Deploy the stack on Fly

Two Fly apps: the **database** (stateful, with a volume) and the **API**
(Kong+GoTrue+PostgREST, stateless). Run from `infra/supabase/`.

### B1. Database app

```bash
fly launch --no-deploy --name leakstop-db --region mad
fly volumes create pgdata --size 10 --region mad -a leakstop-db
```

Point its `fly.toml` at the `supabase/postgres` image, mount `pgdata` at
`/var/lib/postgresql/data`, set the DB env (`POSTGRES_PASSWORD`, `JWT_SECRET`)
as secrets, and keep it on the **private network only** (no public IP):

```bash
fly secrets set -a leakstop-db POSTGRES_PASSWORD="..." JWT_SECRET="..."
fly deploy -a leakstop-db
```

The DB is then reachable from the API app at `leakstop-db.internal:5432`.

### B2. API app (Kong + GoTrue + PostgREST)

The three API services share the private network and only Kong is exposed.
On Fly, run them as one app with a process group per service, or as small
separate apps — either way set `db` to `leakstop-db.internal` in the
connection strings and set every secret from `.env`:

```bash
fly launch --no-deploy --name leakstop-supabase --region mad
fly secrets set -a leakstop-supabase \
  POSTGRES_PASSWORD="..." JWT_SECRET="..." \
  ANON_KEY="..." SERVICE_ROLE_KEY="..." \
  API_EXTERNAL_URL="https://leakstop-supabase.fly.dev" \
  SITE_URL="https://leakstop.fly.dev" \
  SMTP_HOST="..." SMTP_PORT="587" SMTP_USER="..." SMTP_PASS="..." \
  SMTP_ADMIN_EMAIL="..."
fly deploy -a leakstop-supabase
```

Only Kong's port 8000 is public; GoTrue and PostgREST stay internal.
`https://leakstop-supabase.fly.dev` is your new `NEXT_PUBLIC_SUPABASE_URL`.

---

## C. Migrate data AND auth users from Supabase

This is the irreversible part. Put the app in maintenance (or accept a short
read-only window) so no writes are lost mid-copy.

```bash
# 1. Dump EVERYTHING from the current Supabase — including the `auth` schema,
#    which holds the user accounts and password hashes. Get the connection
#    string from Supabase: Project Settings > Database > Connection string.
pg_dump "postgresql://postgres:[PWD]@db.[REF].supabase.co:5432/postgres" \
  --no-owner --no-privileges \
  --schema=public --schema=auth \
  -Fc -f leakstop-backup.dump

# 2. Open a proxy to the Fly DB (keeps it off the public internet).
fly proxy 5433:5432 -a leakstop-db

# 3. Restore into the Fly Postgres (in another terminal).
pg_restore --no-owner --no-privileges --clean --if-exists \
  -d "postgresql://postgres:[FLY_PWD]@localhost:5433/postgres" \
  leakstop-backup.dump
```

Because the `auth` schema travels with the dump, **every existing user keeps
their password and logs in unchanged** — no password resets, no re-signup.
The 75 RLS policies come across in the `public` schema too.

> Starting fresh instead of migrating? Skip C and apply the app schema once:
> `psql <fly-db-url> -f ../../supabase/schema.sql`.

---

## D. Point the app at the new backend & cut over

In the LeakStop app (its own Fly app), swap the three Supabase env values:

```bash
fly secrets set -a leakstop \
  SUPABASE_SERVICE_ROLE_KEY="<new SERVICE_ROLE_KEY>"
# and rebuild with the public ones as build args:
fly deploy -a leakstop \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://leakstop-supabase.fly.dev" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="<new ANON_KEY>" \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ID="price_..." \
  --build-arg NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL="price_..." \
  --build-arg NEXT_PUBLIC_SITE_URL="https://leakstop.fly.dev"
```

Then verify, end to end:

- [ ] Sign up a new test user → confirmation email arrives (SMTP works)
- [ ] Log in with a **migrated** account → succeeds with the old password
- [ ] Dashboard loads a restaurant's data → RLS lets a member see only their rows
- [ ] A second account cannot see the first's data → RLS isolation holds
- [ ] Stripe checkout + webhook updates subscription_status (service_role write)
- [ ] Password reset email arrives and the link works

Only once all pass: decommission the Supabase cloud project.

---

## Operational notes (this is now yours to run)

- **Backups:** schedule `pg_dump` of `leakstop-db` (e.g. a Fly cron app or
  `fly postgres` snapshots if you used a managed instance). You own this now.
- **SMTP** is the one unavoidable outside dependency — auth emails need a mail
  provider. It is not application hosting, so Fly is still your sole app/infra
  provider.
- **Upgrades:** bump the image tags in `docker-compose.yml` / the Fly configs
  deliberately and test GoTrue/PostgREST/Postgres majors in staging first.
- **JWT_SECRET** is the crown jewel: the same value must be set on Postgres,
  GoTrue, PostgREST and Kong, and it signs every session.
