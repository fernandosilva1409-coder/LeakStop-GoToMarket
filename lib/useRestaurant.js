import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "./supabaseClient";

// Shared by every /dashboard/* page: confirms there's a session, resolves the
// restaurant the logged-in user belongs to (first membership, for now), and
// redirects to /login if there's no session.
export function useRestaurant() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: membership, error: memberError } = await supabase
        .from("restaurant_members")
        .select("restaurant_id, restaurants(*)")
        .eq("user_id", session.user.id)
        .limit(1)
        .single();

      if (!active) return;
      if (memberError || !membership) { setError("No restaurant found for this account."); setLoading(false); return; }
      setRestaurant(membership.restaurants);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  return { restaurant, loading, error };
}
