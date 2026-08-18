import { forwardRef } from "react";

const Input = forwardRef(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`rounded-xl border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-brass focus:bg-surface-card focus:outline-none focus:ring-2 focus:ring-brass/20 ${className}`}
      {...props}
    />
  );
});

export default Input;
