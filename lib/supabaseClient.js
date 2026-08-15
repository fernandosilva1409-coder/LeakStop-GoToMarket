import { createClient } from "@supabase/supabase-js";

// Client-side Supabase client — safe to use in the browser. Row Level Security
// (see supabase/schema.sql) enforces that this can only ever read/write rows
// belonging to restaurants the logged-in user is a member of.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
