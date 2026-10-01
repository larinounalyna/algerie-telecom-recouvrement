import { ReactNode } from "react";

interface SectionProps {
  title: string;
  accentClass: string;
  children: ReactNode;
  className?: string;
}

export default function Section({ title, accentClass, children, className = "" }: SectionProps) {
  return (
    <div className={`flex flex-col min-h-0 ${className}`}>
      <div className="mb-1.5 flex items-center gap-2 flex-shrink-0">
        <div className={`w-1 h-4 rounded-full ${accentClass}`} />
        <span className="text-[13px] font-semibold text-[#1b2338]">{title}</span>
      </div>
      <div className="bg-white rounded-lg border border-border shadow-sm p-3.5 space-y-2.5 overflow-auto min-h-0">{children}</div>
    </div>
  );
}
