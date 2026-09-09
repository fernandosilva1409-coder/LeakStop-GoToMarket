import { ChefHat } from "lucide-react";

// The $ sits inside the hat's puffy top, not the band at the bottom, so it's
// nudged up a hair from dead-center — see chef-hat.js's path for why.
const SIZES = {
  sm: { box: "h-9 w-9", radius: "rounded-lg", icon: 18, dollar: "text-[10px] -mt-0.5" },
  md: { box: "h-10 w-10", radius: "rounded-xl", icon: 22, dollar: "text-[12px] -mt-0.5" },
  lg: { box: "h-12 w-12", radius: "rounded-xl", icon: 26, dollar: "text-[14px] -mt-1" },
};

export default function Logo({ size = "md", className = "" }) {
  const s = SIZES[size];
  return (
    <div className={`relative flex ${s.box} shrink-0 items-center justify-center ${s.radius} bg-gradient-to-br from-brass-light to-brass text-heading shadow-soft ${className}`}>
      <ChefHat size={s.icon} strokeWidth={2.2} />
      <span className={`absolute inset-0 flex items-center justify-center font-mono font-black leading-none ${s.dollar}`}>$</span>
    </div>
  );
}
