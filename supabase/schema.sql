-- LeakStop database schema (Supabase / Postgres)
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Multi-tenant: every table carries restaurant_id, isolated via Row Level Security.

-- ---------------------------------------------------------------------------
-- Restaurants (the "tenant") and membership
-- ---------------------------------------------------------------------------
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'EUR',
  language text not null default 'en',
  stripe_customer_id text,
  stripe_subscription_id text,
  -- "none" until the Stripe webhook marks it trialing/active after a real
  -- checkout — never default to trialing here, or every signup gets a free
  -- account without ever registering a card.
  subscription_status text not null default 'none', -- none | trialing | active | past_due | canceled
  city text, -- display label for the geocoded location below; weather correlation needs latitude/longitude
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  weather_proposal text, -- Haiku-written weekly weather proposal (Weather page), cached ~24h
  weather_proposal_at timestamptz,
  overhead_explanation text, -- Sonnet-written explanation of the overhead-per-plate numbers (Dashboard/Rentabilidade), cached ~24h
  overhead_explanation_at timestamptz,
  analysis_cache jsonb, -- cached computeAnalysis() output; analysis_cache_at null = stale, see triggers below
  analysis_cache_at timestamptz,
  created_at timestamptz not null default now()
);

-- Links a Supabase auth user to one or more restaurants (supports staff accounts later)
create table restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner', -- owner | staff
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Products — the canonical bridge between "how a product is purchased"
-- (purchases.unit, often a whole priced package like "un"/"cx" with no
-- per-kg data) and "how a recipe uses it" (dish_ingredients.unit, usually a
-- natural unit like g/ml). package_qty/package_unit is the one-time
-- conversion factor that lets those two sides differ freely — see
-- lib/products.js for how new products get resolved-or-created
-- (name-matched first, AI-assisted for anything new) from every Purchases/
-- Menu entry path (manual, CSV, PDF).
-- ---------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  purchase_unit text not null, -- un | cx | kg | g | l | ml — the unit purchases of this product are normally recorded in
  package_qty numeric(12, 4), -- null when purchase_unit is already a real weight/volume unit (kg/g/l/ml) — no conversion needed
  package_unit text, -- g | ml | kg | l | dozen | ... — the unit package_qty is expressed in (e.g. 1 kg bag bought as "un")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, name)
);
create index idx_products_restaurant on products(restaurant_id);

-- ---------------------------------------------------------------------------
-- Menu: dishes + their ingredients
-- ---------------------------------------------------------------------------
create table dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  category text,
  price numeric(10, 2) not null default 0,
  prep_time numeric(6, 1), -- minutes, nullable
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table dish_ingredients (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references dishes(id) on delete cascade,
  name text not null,
  -- 6dp, not 3: ingredients bought as a whole priced package ("un") are
  -- often recorded as a small fraction of that package per dish (e.g.
  -- 0.00015 "un" of a 10L oil drum for a pasta dough) — numeric(10,3)
  -- silently rounded those to 0, zeroing that ingredient's cost everywhere.
  qty numeric(14, 6) not null default 0,
  unit text not null default 'g', -- g | kg | ml | l | unit | ...
  -- Nullable and additive: when set, cost calc converts qty/unit through
  -- the product's own package size instead of requiring qty/unit to
  -- already share a literal dimension with however the product was
  -- purchased (see lib/products.js, lib/calculations.js). Null rows fall
  -- back to the pre-existing name+dimension matching, unchanged.
  product_id uuid references products(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Purchases (from suppliers)
-- ---------------------------------------------------------------------------
create table purchases (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  item text not null,
  quantity numeric(10, 3) not null default 0,
  unit text not null default 'g',
  unit_price numeric(10, 4) not null default 0,
  date date not null,
  supplier text,
  source_filename text, -- name of the PDF this row was extracted from, if any (see pdf_imports)
  product_id uuid references products(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_purchases_product on purchases(product_id);

-- ---------------------------------------------------------------------------
-- Sales (what was actually sold)
-- ---------------------------------------------------------------------------
create table sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  dish_name text not null, -- kept as text, not a dish_id FK: sales can reference names that don't (yet) match a menu item
  quantity numeric(10, 2) not null default 0,
  date date not null,
  source_filename text, -- name of the PDF this row was extracted from, if any (see pdf_imports)
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PDF imports — one row per PDF a user has successfully imported into
-- purchases/sales, keyed by a content hash (not filename alone, which can
-- repeat or be renamed) so re-selecting an already-imported invoice is
-- detected before spending a Claude call on it, and every purchase/sale row
-- can be traced back to the file it came from via source_filename above.
-- ---------------------------------------------------------------------------
create table pdf_imports (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'sale')),
  filename text not null,
  file_hash text not null, -- SHA-256 of the file bytes, hex-encoded
  row_count integer not null default 0,
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, kind, file_hash)
);

-- ---------------------------------------------------------------------------
-- Overhead settings — one row per restaurant (mirrors the Overhead tab)
-- ---------------------------------------------------------------------------
create table overhead_settings (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  kitchen_labor numeric(10, 2) not null default 0,
  table_labor numeric(10, 2) not null default 0,
  other_labor numeric(10, 2) not null default 0,
  payroll_tax numeric(10, 2) not null default 0,
  building_cost numeric(10, 2) not null default 0,
  energy_cost numeric(10, 2) not null default 0,
  gas_cost numeric(10, 2) not null default 0,
  water_cost numeric(10, 2) not null default 0,
  waste_collection numeric(10, 2) not null default 0,
  cleaning_supplies numeric(10, 2) not null default 0,
  software_admin numeric(10, 2) not null default 0,
  other_cost numeric(10, 2) not null default 0,
  method text not null default 'even', -- even | prepTime
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Analytics widgets — snapshots pinned from "Chat with Your Data" answers,
-- shown on the Analytics page. `data` is the raw tool output at pin time
-- (not re-queried), so a widget keeps showing what the user pinned even as
-- the underlying numbers change later.
-- ---------------------------------------------------------------------------
create table analytics_widgets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  title text not null,
  tool_name text not null,
  tool_input jsonb not null default '{}'::jsonb,
  data jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chat messages — persists "Chat with Your Data" history per restaurant, so
-- it survives reloads/devices. `tool_calls` mirrors what /api/chat returned
-- (name/input/output per call) so the "pin as chart" button keeps working
-- on messages loaded from history, not just ones just received.
-- ---------------------------------------------------------------------------
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  role text not null, -- user | assistant
  content text not null,
  tool_calls jsonb,
  pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Excluded categories — menu categories the restaurant has opted out of
-- margin/profitability analytics for (Dashboard KPIs, dish profitability
-- table, Recommendations matrix). Ingredient-level waste and raw sales are
-- unaffected — a category's dishes still sell and still consume ingredients,
-- they just don't get judged by the food-cost/margin model, which doesn't
-- fit things like bottled drinks well (overhead-per-plate on a bottle of
-- water produces a meaningless negative "margin").
-- ---------------------------------------------------------------------------
create table excluded_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category text not null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, category)
);

-- ---------------------------------------------------------------------------
-- Weather daily — cached historical weather for the restaurant's location
-- (Open-Meteo archive API, free, no key), so "Chat with Your Data" can
-- correlate sales against weather without re-fetching on every request.
-- weather_code follows the WMO code table Open-Meteo returns.
-- ---------------------------------------------------------------------------
create table weather_daily (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  date date not null,
  temp_max numeric(5, 1),
  temp_min numeric(5, 1),
  precipitation_mm numeric(6, 1),
  weather_code integer,
  created_at timestamptz not null default now(),
  unique (restaurant_id, date)
);

-- ---------------------------------------------------------------------------
-- Indexes for the queries the app actually makes
-- ---------------------------------------------------------------------------
create index idx_dishes_restaurant on dishes(restaurant_id);
create index idx_dish_ingredients_dish on dish_ingredients(dish_id);
create index idx_purchases_restaurant_date on purchases(restaurant_id, date);
create index idx_sales_restaurant_date on sales(restaurant_id, date);
create index idx_members_user on restaurant_members(user_id);
create index idx_analytics_widgets_restaurant on analytics_widgets(restaurant_id);
create index idx_chat_messages_restaurant on chat_messages(restaurant_id, created_at);
create index idx_excluded_categories_restaurant on excluded_categories(restaurant_id);
create index idx_weather_daily_restaurant_date on weather_daily(restaurant_id, date);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user can only touch rows belonging to a restaurant
-- they are a member of. This is enforced by Postgres itself, not just app code.
-- ---------------------------------------------------------------------------
alter table restaurants enable row level security;
alter table restaurant_members enable row level security;
alter table dishes enable row level security;
alter table dish_ingredients enable row level security;
alter table purchases enable row level security;
alter table sales enable row level security;
alter table overhead_settings enable row level security;
alter table analytics_widgets enable row level security;
alter table chat_messages enable row level security;
alter table excluded_categories enable row level security;
alter table weather_daily enable row level security;
alter table pdf_imports enable row level security;
alter table products enable row level security;

-- Helper: is the current user a member of a given restaurant?
create or replace function is_restaurant_member(target_restaurant_id uuid)
returns boolean as $$
  select exists (
    select 1 from restaurant_members
    where restaurant_id = target_restaurant_id
      and user_id = auth.uid()
  );
$$ language sql security definer stable;

create policy "members can read their restaurant" on restaurants
  for select using (is_restaurant_member(id));
create policy "members can update their restaurant" on restaurants
  for update using (is_restaurant_member(id));

create policy "members can see their own membership rows" on restaurant_members
  for select using (user_id = auth.uid());

create policy "members can read dishes" on dishes
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write dishes" on dishes
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update dishes" on dishes
  for update using (is_restaurant_member(restaurant_id));
create policy "members can delete dishes" on dishes
  for delete using (is_restaurant_member(restaurant_id));

create policy "members can read ingredients" on dish_ingredients
  for select using (exists (select 1 from dishes where dishes.id = dish_ingredients.dish_id and is_restaurant_member(dishes.restaurant_id)));
create policy "members can write ingredients" on dish_ingredients
  for insert with check (exists (select 1 from dishes where dishes.id = dish_ingredients.dish_id and is_restaurant_member(dishes.restaurant_id)));
create policy "members can update ingredients" on dish_ingredients
  for update using (exists (select 1 from dishes where dishes.id = dish_ingredients.dish_id and is_restaurant_member(dishes.restaurant_id)));
create policy "members can delete ingredients" on dish_ingredients
  for delete using (exists (select 1 from dishes where dishes.id = dish_ingredients.dish_id and is_restaurant_member(dishes.restaurant_id)));

create policy "members can read purchases" on purchases
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write purchases" on purchases
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update purchases" on purchases
  for update using (is_restaurant_member(restaurant_id));
create policy "members can delete purchases" on purchases
  for delete using (is_restaurant_member(restaurant_id));

create policy "members can read products" on products
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write products" on products
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update products" on products
  for update using (is_restaurant_member(restaurant_id));
create policy "members can delete products" on products
  for delete using (is_restaurant_member(restaurant_id));

create policy "members can read sales" on sales
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write sales" on sales
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update sales" on sales
  for update using (is_restaurant_member(restaurant_id));
create policy "members can delete sales" on sales
  for delete using (is_restaurant_member(restaurant_id));

create policy "members can read pdf imports" on pdf_imports
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write pdf imports" on pdf_imports
  for insert with check (is_restaurant_member(restaurant_id));

create policy "members can read overhead" on overhead_settings
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write overhead" on overhead_settings
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update overhead" on overhead_settings
  for update using (is_restaurant_member(restaurant_id));

create policy "members can read analytics widgets" on analytics_widgets
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write analytics widgets" on analytics_widgets
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can delete analytics widgets" on analytics_widgets
  for delete using (is_restaurant_member(restaurant_id));

create policy "members can read chat messages" on chat_messages
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write chat messages" on chat_messages
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update chat messages" on chat_messages
  for update using (is_restaurant_member(restaurant_id));

create policy "members can read excluded categories" on excluded_categories
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write excluded categories" on excluded_categories
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can delete excluded categories" on excluded_categories
  for delete using (is_restaurant_member(restaurant_id));
create policy "members can delete chat messages" on chat_messages
  for delete using (is_restaurant_member(restaurant_id));

create policy "members can read weather" on weather_daily
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write weather" on weather_daily
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update weather" on weather_daily
  for update using (is_restaurant_member(restaurant_id));
create policy "members can delete weather" on weather_daily
  for delete using (is_restaurant_member(restaurant_id));

-- ---------------------------------------------------------------------------
-- Convenience: when a new restaurant is created, auto-create its owner
-- membership and a zeroed overhead row. Called from the signup flow.
-- ---------------------------------------------------------------------------
create or replace function create_restaurant_for_user(restaurant_name text, p_currency text, p_language text)
returns uuid as $$
declare
  new_id uuid;
begin
  insert into restaurants (name, currency, language) values (restaurant_name, p_currency, p_language) returning id into new_id;
  insert into restaurant_members (restaurant_id, user_id, role) values (new_id, auth.uid(), 'owner');
  insert into overhead_settings (restaurant_id) values (new_id);
  return new_id;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------------------
-- Invalidate the cached analysis (lib/analysisCache.js) whenever any table
-- computeAnalysis reads from changes. analysis_cache_at = null is the only
-- "needs recompute" signal the app checks — a DB trigger keeps that correct
-- for any write path (manual edit, CSV import, a future integration) without
-- needing every mutation site in the app to remember to invalidate it.
-- ---------------------------------------------------------------------------
create or replace function mark_analysis_dirty_for_restaurant(target_restaurant_id uuid)
returns void as $$
  update restaurants set analysis_cache_at = null where id = target_restaurant_id;
$$ language sql security definer;

create or replace function trg_mark_analysis_dirty()
returns trigger as $$
begin
  perform mark_analysis_dirty_for_restaurant(coalesce(NEW.restaurant_id, OLD.restaurant_id));
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists sales_mark_analysis_dirty on sales;
create trigger sales_mark_analysis_dirty after insert or update or delete on sales
  for each row execute function trg_mark_analysis_dirty();

drop trigger if exists purchases_mark_analysis_dirty on purchases;
create trigger purchases_mark_analysis_dirty after insert or update or delete on purchases
  for each row execute function trg_mark_analysis_dirty();

drop trigger if exists products_mark_analysis_dirty on products;
create trigger products_mark_analysis_dirty after insert or update or delete on products
  for each row execute function trg_mark_analysis_dirty();

drop trigger if exists dishes_mark_analysis_dirty on dishes;
create trigger dishes_mark_analysis_dirty after insert or update or delete on dishes
  for each row execute function trg_mark_analysis_dirty();

drop trigger if exists overhead_mark_analysis_dirty on overhead_settings;
create trigger overhead_mark_analysis_dirty after insert or update or delete on overhead_settings
  for each row execute function trg_mark_analysis_dirty();

drop trigger if exists excluded_categories_mark_analysis_dirty on excluded_categories;
create trigger excluded_categories_mark_analysis_dirty after insert or update or delete on excluded_categories
  for each row execute function trg_mark_analysis_dirty();

-- dish_ingredients has no restaurant_id column of its own — resolve it via
-- the owning dish. (On delete of the dish itself, dish_ingredients rows are
-- removed by their own FK cascade, which fires this same trigger per row.)
create or replace function trg_mark_analysis_dirty_via_dish()
returns trigger as $$
declare
  target_id uuid;
begin
  select restaurant_id into target_id from dishes where id = coalesce(NEW.dish_id, OLD.dish_id);
  if target_id is not null then
    perform mark_analysis_dirty_for_restaurant(target_id);
  end if;
  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists dish_ingredients_insert_dirty on dish_ingredients;
create trigger dish_ingredients_insert_dirty
  after insert on dish_ingredients
  for each row execute function trg_mark_analysis_dirty_via_dish();

drop trigger if exists dish_ingredients_update_dirty on dish_ingredients;
create trigger dish_ingredients_update_dirty
  after update on dish_ingredients
  for each row execute function trg_mark_analysis_dirty_via_dish();

drop trigger if exists dish_ingredients_delete_dirty on dish_ingredients;
create trigger dish_ingredients_delete_dirty
  after delete on dish_ingredients
  for each row execute function trg_mark_analysis_dirty_via_dish();
