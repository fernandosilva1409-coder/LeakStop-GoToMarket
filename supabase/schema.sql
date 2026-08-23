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
  subscription_status text not null default 'trialing', -- trialing | active | past_due | canceled
  city text, -- display label for the geocoded location below; weather correlation needs latitude/longitude
  latitude numeric(9, 6),
  longitude numeric(9, 6),
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
  qty numeric(10, 3) not null default 0,
  unit text not null default 'g' -- g | kg | ml | l | unit | ...
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
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sales (what was actually sold)
-- ---------------------------------------------------------------------------
create table sales (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  dish_name text not null, -- kept as text, not a dish_id FK: sales can reference names that don't (yet) match a menu item
  quantity numeric(10, 2) not null default 0,
  date date not null,
  created_at timestamptz not null default now()
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

create policy "members can read sales" on sales
  for select using (is_restaurant_member(restaurant_id));
create policy "members can write sales" on sales
  for insert with check (is_restaurant_member(restaurant_id));
create policy "members can update sales" on sales
  for update using (is_restaurant_member(restaurant_id));
create policy "members can delete sales" on sales
  for delete using (is_restaurant_member(restaurant_id));

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
