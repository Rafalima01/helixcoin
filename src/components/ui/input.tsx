"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon: Icon, hint, type, id, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const isPassword = type === "password";
    const inputId = id ?? props.name;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-text-muted" />
          )}
          <input
            ref={ref}
            id={inputId}
            type={isPassword ? (show ? "text" : "password") : type}
            className={cn(
              "w-full h-12 rounded-2xl bg-white/[0.03] border border-border px-4 text-[15px] text-text placeholder:text-text-muted outline-none transition-all duration-200",
              "focus:border-purple/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]",
              Icon && "pl-11",
              isPassword && "pr-11",
              error &&
                "border-error/60 focus:border-error focus:shadow-[0_0_0_4px_rgba(255,77,109,0.12)]",
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((s) => !s)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          )}
        </div>
        {error ? (
          <span className="text-xs text-error font-medium">{error}</span>
        ) : hint ? (
          <span className="text-xs text-text-muted">{hint}</span>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
