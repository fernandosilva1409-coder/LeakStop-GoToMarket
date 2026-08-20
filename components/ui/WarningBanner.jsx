import { AlertTriangle } from "lucide-react";

export default function WarningBanner({ children }) {
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-warn-border bg-warn-bg px-4 py-3 text-sm text-warn-text">
      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
