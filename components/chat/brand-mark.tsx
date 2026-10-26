import { cn } from "@/lib/utils";

/**
 * Lumen's identity mark: a warm gradient squircle with a serif monogram.
 * Used consistently in the sidebar, welcome screen, and assistant turns.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[linear-gradient(135deg,var(--brand),var(--brand-warm))] text-white shadow-[0_6px_18px_-8px_var(--brand)]",
        className,
      )}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.38),transparent_60%)]" />
      <span className="relative -mt-px font-serif text-[0.95em] font-semibold leading-none">L</span>
    </span>
  );
}
