import Link from "next/link";
import { useRouter } from "next/router";
import { ChefHat, LayoutDashboard, UtensilsCrossed, Package, Receipt, Calculator, Lightbulb, LogOut } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/purchases", label: "Compras", icon: Package },
  { href: "/dashboard/sales", label: "Vendas", icon: Receipt },
  { href: "/dashboard/overhead", label: "Overhead", icon: Calculator },
  { href: "/dashboard/recommendations", label: "Recomendações", icon: Lightbulb },
];

export default function DashboardNav() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <nav className="border-b border-ink-border bg-ink-bg">
      <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 sm:px-6">
        <Link href="/dashboard" className="mr-6 flex shrink-0 items-center gap-2 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brass text-ink-bg">
            <ChefHat size={15} strokeWidth={2.2} />
          </div>
          <span className="text-sm font-bold text-paper">LeakStop</span>
        </Link>
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = router.pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-4 text-[13.5px] font-semibold transition-colors ${
                active ? "border-brass text-brass" : "border-transparent text-muted hover:text-paper"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="ml-auto flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3.5 py-4 text-[13.5px] font-semibold text-faint hover:text-paper"
        >
          <LogOut size={16} strokeWidth={2} />
          Sair
        </button>
      </div>
    </nav>
  );
}
