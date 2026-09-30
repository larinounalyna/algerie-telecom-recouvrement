interface BackLinkProps {
  onClick: () => void;
  label?: string;
  /** Use "light" on a dark/colored header bar, "muted" on a plain background. */
  tone?: "muted" | "light";
}

/** "← Retour" link, styled either for a plain page or a colored header bar. */
export default function BackLink({ onClick, label = "← Retour", tone = "muted" }: BackLinkProps) {
  const toneClass =
    tone === "light"
      ? "text-white hover:opacity-80"
      : "text-muted hover:text-[#1C2235]";
  return (
    <button onClick={onClick} className={`flex items-center gap-2 text-lg transition-colors ${toneClass}`}>
      {label}
    </button>
  );
}
