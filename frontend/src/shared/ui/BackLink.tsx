interface BackLinkProps {
  onClick: () => void;
  label?: string;
  /** Use "light" on the dark header bar, "muted" on a plain background. */
  tone?: "muted" | "light";
}

/** "← Retour" link, styled either for a plain page or the brand header bar. */
export default function BackLink({ onClick, label = "← Retour", tone = "muted" }: BackLinkProps) {
  const toneClass =
    tone === "light"
      ? "text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border-white/25"
      : "text-brand hover:bg-brand-soft border-border";
  return (
    <button onClick={onClick} className={`flex items-center gap-2 text-sm font-medium px-3.5 py-1.5 rounded-md border transition-colors ${toneClass}`}>
      {label}
    </button>
  );
}
