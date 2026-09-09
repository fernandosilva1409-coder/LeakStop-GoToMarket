import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "./supabaseClient";

// A restaurant only gets to see the app while Stripe actually has an open
// subscription for it — "trialing" during the 5 free days, "active" once
// billed. Everything else (never checked out, canceled, payment failed for
// too long) is treated as no access, so the free trial requires a card on
// file rather than being reachable by just creating an account.
export function hasActiveAccess(restaurant) {
  return restaurant?.subscription_status === "trialing" || restaurant?.subscription_status === "active";
}

// Shared by every /dashboard/* page: confirms there's a session, resolves the
// restaurant the logged-in user belongs to (first membership, for now), and
// redirects to /login if there's no session. Pages other than /dashboard
// itself (the only one that renders a paywall instead of data) also get
// bounced back there if the restaurant has no active Stripe subscription —
// /dashboard?checkout=success is exempted so the redirect from Stripe isn't
// immediately kicked back out while the webhook is still catching up.
export function useRestaurant() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/login"); return null; }

    const { data: membership, error: memberError } = await supabase
      .from("restaurant_members")
      .select("restaurant_id, restaurants(*)")
      .eq("user_id", session.user.id)
      .limit(1)
      .single();

    if (memberError || !membership) { setError("No restaurant found for this account."); return null; }
    return membership.restaurants;
  }, [router]);

  useEffect(() => {
    let active = true;
    (async () => {
      const rest = await load();
      if (!active) return;
      if (rest) {
        setRestaurant(rest);
        if (!hasActiveAccess(rest) && router.pathname !== "/dashboard") {
          router.replace("/dashboard");
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.pathname]);

  const refetch = useCallback(async () => {
    const rest = await load();
    if (rest) setRestaurant(rest);
    return rest;
  }, [load]);

  return { restaurant, loading, error, refetch };
}
