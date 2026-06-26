"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  active?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

const sizes: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5",
  md: "text-sm px-4 py-2",
  lg: "text-sm px-5 py-2.5",
};

const variants: Record<Variant, string> = {
  primary: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:border-red-300 hover:text-red-700",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  danger:
    "bg-white text-red-600 border border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600",
  subtle: "bg-gray-100 text-gray-700 hover:bg-gray-200",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "secondary", size = "md", leftIcon, rightIcon, active, className = "", children, ...props },
    ref
  ) => {
    const activeCls = active
      ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
      : "";
    return (
      <button
        ref={ref}
        className={`${base} ${sizes[size]} ${active ? variants.primary + " " + activeCls : variants[variant]} ${className}`}
        {...props}
      >
        {leftIcon}
        {children}
        {rightIcon}
      </button>
    );
  }
);
Button.displayName = "Button";
