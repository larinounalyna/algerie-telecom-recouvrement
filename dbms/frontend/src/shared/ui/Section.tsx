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
      <div className="mb-1 flex items-center gap-2 flex-shrink-0">
        <div className={`w-1 h-3.5 rounded-full ${accentClass}`} />
        <span className="text-sm text-[#1C2235]">{title}</span>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 overflow-auto min-h-0">
        {children}
      </div>
    </div>
  );
}
