import { ReactNode } from "react";
import BackLink from "./BackLink";

interface PageHeaderBarProps {
  title: string;
  onBack: () => void;
  /** Tailwind background class for the bar, e.g. "bg-red-600". */
  bgClass?: string;
  /** Tailwind color class for the divider, e.g. "bg-red-400". */
  dividerClass?: string;
  right?: ReactNode;
}

/** Full-width colored header bar with a back link, a title, and optional
 * right-aligned content (used by SystemPage). */
export default function PageHeaderBar({
  title,
  onBack,
  bgClass = "bg-red-600",
  dividerClass = "bg-red-400",
  right,
}: PageHeaderBarProps) {
  return (
    <div className={`px-6 py-4 flex items-center gap-5 flex-shrink-0 ${bgClass}`}>
      <BackLink onClick={onBack} tone="light" />
      <div className={`w-px h-7 ${dividerClass}`} />
      <h1 className="text-2xl text-white flex-1">{title}</h1>
      {right}
    </div>
  );
}
