import { forwardRef } from "react";

const Select = forwardRef(function Select({ className = "", children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`rounded-xl border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-heading focus:border-brass focus:bg-surface-card focus:outline-none focus:ring-2 focus:ring-brass/20 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
});

export default Select;
