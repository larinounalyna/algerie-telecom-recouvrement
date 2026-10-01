import { ReactNode } from "react";
import BackLink from "./BackLink";
import BrandHeader from "./BrandHeader";

interface PageHeaderBarProps {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}

/** Brand header: back link, logo + institution (FR/AR), page title. */
export default function PageHeaderBar({ title, onBack, right }: PageHeaderBarProps) {
  return (
    <header className="flex-shrink-0 bg-brand border-b-4 border-leaf pl-6 pr-20 py-2.5 flex items-center gap-5 no-print">
      <BackLink onClick={onBack} tone="light" />
      <div className="w-px h-9 bg-white/25" />
      <BrandHeader tone="dark" compact />
      <div className="flex-1" />
      <h1 className="text-[15px] font-semibold text-white tracking-wide">{title}</h1>
      {right}
    </header>
  );
}
