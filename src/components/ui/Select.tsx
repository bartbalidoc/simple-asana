"use client";

import { ChevronDownIcon } from "./icons";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  // Wrapper classes; default block-level so the select fills its parent like
  // the app's text inputs do. Pass "relative inline-block" for inline use.
  containerClassName?: string;
}

// The one select style for the whole app: same border, height, and red focus
// ring as text inputs, with a consistent chevron instead of the OS default.
export function Select({
  className = "",
  containerClassName = "relative",
  children,
  ...props
}: SelectProps) {
  return (
    <div className={containerClassName}>
      <select
        className={`w-full appearance-none rounded-md border border-gray-300 bg-white pl-3 pr-8 py-2 text-sm text-gray-800 transition focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-gray-50 disabled:text-gray-400 ${className}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
    </div>
  );
}
