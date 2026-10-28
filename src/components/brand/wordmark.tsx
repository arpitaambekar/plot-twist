import { cn } from "@/lib/utils";

/** Typographic wordmark: "plot twist." with the full stop as the brand accent. */
export function Wordmark({ className, dotClassName, light }: { className?: string; dotClassName?: string; light?: boolean }) {
  return (
    <span className={cn("select-none font-semibold tracking-[-0.035em]", light ? "text-white" : "text-ink", className)} aria-label="plot twist.">
      plot twist<span className={cn("text-accent", light && "text-[#9db4ff]", dotClassName)}>.</span>
    </span>
  );
}
