import { InputHTMLAttributes } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  mono?: boolean;
  filled?: boolean;
  filledClass?: string;
  wrapperClassName?: string;
}

export default function Field({
  label,
  mono,
  filled,
  filledClass = "bg-amber-50 border border-amber-400",
  wrapperClassName,
  required,
  ...inputProps
}: FieldProps) {
  const base = "w-full rounded-md px-3 py-1.5 text-sm text-[#1b2338] focus:outline-none transition-colors placeholder:text-gray-400";
  const style = filled ? `${filledClass} ${base}` : `bg-white border border-border2 focus:border-brand focus:ring-2 focus:ring-brand/15 ${base}`;

  return (
    <div className={wrapperClassName}>
      <label className="block text-[11.5px] font-medium text-muted mb-1">
        {label}
        {required && " *"}
      </label>
      <input {...inputProps} className={`${style} ${mono ? "font-mono text-[13px]" : ""}`} />
    </div>
  );
}
