#!/bin/bash
# Runs once on first init of an empty DB volume. supabase/postgres already
# creates the Supabase roles (anon, authenticated, service_role, authenticator,
# supabase_auth_admin, ...); here we just give the two LOGIN roles the password
# the stack connects with. PostgREST logs in as `authenticator`, GoTrue as
# `supabase_auth_admin` — both use POSTGRES_PASSWORD in docker-compose.yml.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  ALTER ROLE authenticator        WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ALTER ROLE supabase_auth_admin  WITH LOGIN PASSWORD '${POSTGRES_PASSWORD}';
EOSQL
