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
  filledClass = "bg-amber-50 border-2 border-amber-400",
  wrapperClassName,
  required,
  ...inputProps
}: FieldProps) {
  const base =
    "w-full rounded-lg px-3 py-1.5 text-sm text-[#1C2235] focus:outline-none transition-colors placeholder:text-gray-400";
  const style = filled
    ? `${filledClass} ${base}`
    : `bg-white border-2 border-gray-300 focus:border-amber-500 ${base}`;

  return (
    <div className={wrapperClassName}>
      <label className="block text-[11px] text-gray-500 mb-0.5">
        {label}
        {required && " *"}
      </label>
      <input {...inputProps} className={`${style} ${mono ? "font-mono" : ""}`} />
    </div>
  );
}
