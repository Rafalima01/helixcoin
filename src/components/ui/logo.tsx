import { cn } from "@/lib/utils";

export function Logo({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="shrink-0">
        <defs>
          <linearGradient
            id="logoGrad"
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#FF4FAE" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="15" stroke="url(#logoGrad)" strokeWidth="2" opacity="0.35" />
        <path
          d="M8 11c2.5 2 5.5 2 8 0s5.5-2 8 0"
          stroke="url(#logoGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M8 16c2.5 2 5.5 2 8 0s5.5-2 8 0"
          stroke="url(#logoGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M8 21c2.5 2 5.5 2 8 0s5.5-2 8 0"
          stroke="url(#logoGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>
      {!iconOnly && (
        <span className="text-xl font-extrabold tracking-tight text-white">
          Heli<span className="text-gradient-brand">Jump</span>
        </span>
      )}
    </div>
  );
}
