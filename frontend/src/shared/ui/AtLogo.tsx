import logo from "../../assets/logo-at.png";

const RATIO = 497 / 234; // native width / height of the logo

interface Props {
  /** Height in px; the width is derived from the logo's real ratio so it is never squashed or cropped. */
  height?: number;
  className?: string;
}

/** Algérie Télécom logo (always shown whole). */
export default function AtLogo({ height = 48, className = "" }: Props) {
  const width = Math.round(height * RATIO);
  return (
    <img
      src={logo}
      alt="Algérie Télécom"
      width={width}
      height={height}
      style={{ height, width, minWidth: width, maxWidth: "none", objectFit: "contain" }}
      className={`flex-shrink-0 select-none ${className}`}
      draggable={false}
    />
  );
}
