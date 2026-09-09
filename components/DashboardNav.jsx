import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { LayoutDashboard, UtensilsCrossed, Package, Boxes, Receipt, Calculator, Lightbulb, MessageCircle, BarChart3, CloudSun, LifeBuoy, Settings, LogOut } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { getDashCopy } from "../lib/dashboardCopy";
import Logo from "./ui/Logo";
import pkg from "../package.json";

export default function DashboardNav({ lang = "pt" }) {
  const router = useRouter();
  const t = getDashCopy(lang).nav;
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUserEmail(session?.user?.email || ""));
  }, []);

  // Ordered by decision-making weight and daily usage, most to least: the
  // overview and the day-to-day decision tools (weather proposal, chat,
  // recommendations, analytics) come first; then the operational data-entry
  // pages (sales, purchases, menu, overhead) that feed them; account-level
  // admin pages (support, settings) that are touched rarely go last.
  const LINKS = [
    { href: "/dashboard", label: t.dashboard, icon: LayoutDashboard },
    { href: "/dashboard/weather", label: t.weather, icon: CloudSun },
    { href: "/dashboard/chat", label: t.chat, icon: MessageCircle },
    { href: "/dashboard/recommendations", label: t.recommendations, icon: Lightbulb },
    { href: "/dashboard/analytics", label: t.analytics, icon: BarChart3 },
    { href: "/dashboard/sales", label: t.sales, icon: Receipt },
    { href: "/dashboard/purchases", label: t.purchases, icon: Package },
    { href: "/dashboard/products", label: t.products, icon: Boxes },
    { href: "/dashboard/menu", label: t.menu, icon: UtensilsCrossed },
    { href: "/dashboard/overhead", label: t.overhead, icon: Calculator },
    { href: "/dashboard/support", label: t.support, icon: LifeBuoy },
    { href: "/dashboard/settings", label: t.settings, icon: Settings },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    // Icon-only rail below sm (phones), icon + label sidebar from sm up —
    // purely responsive, no toggle/collapse state to manage.
    <nav className="sticky top-3 m-3 flex h-[calc(100vh-1.5rem)] w-14 shrink-0 flex-col rounded-2xl bg-sidebar-bg shadow-soft-lg sm:w-56">
      <Link href="/dashboard" className="flex shrink-0 items-center justify-center gap-2.5 border-b border-sidebar-border py-4 sm:justify-start sm:px-5">
        <Logo size="sm" />
        <span className="hidden truncate text-sm font-bold text-white sm:inline">LeakStop</span>
      </Link>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3 sm:px-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = router.pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center justify-center gap-3 rounded-xl px-2.5 py-2.5 text-[13.5px] font-semibold transition-colors sm:justify-start sm:px-3 ${
                active ? "bg-sidebar-active/15 text-sidebar-active" : "text-sidebar-text hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={18} strokeWidth={2} className="shrink-0" />
              <span className="hidden truncate sm:inline">{label}</span>
            </Link>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-sidebar-border">
        {userEmail && (
          <p className="hidden truncate px-4 pt-3 text-xs text-sidebar-text/60 sm:block" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          onClick={handleLogout}
          title={t.logout}
          className="flex w-full items-center justify-center gap-3 px-2.5 py-4 text-[13.5px] font-semibold text-sidebar-text/80 hover:text-white sm:justify-start sm:px-3"
        >
          <LogOut size={18} strokeWidth={2} className="shrink-0" />
          <span className="hidden truncate sm:inline">{t.logout}</span>
        </button>
      </div>
      <p className="hidden shrink-0 px-3 pb-3 text-center font-mono text-[10px] text-sidebar-text/40 sm:block">v{pkg.version}</p>
    </nav>
  );
}
