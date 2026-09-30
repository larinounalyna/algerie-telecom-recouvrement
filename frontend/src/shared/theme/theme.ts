import { AccentTheme, DbKind } from "../../types";

export const amberTheme: AccentTheme = {
  bg: "bg-amber-500",
  hover: "hover:bg-amber-600",
  light: "bg-amber-50",
  hoverLight: "hover:bg-amber-50",
  border: "border-amber-400",
  text: "text-amber-700",
  filled: "bg-amber-50 border-2 border-amber-400",
  card: "border-2 border-amber-200 bg-amber-50",
  cardLabel: "text-amber-600",
  cardValue: "text-amber-800",
  focusBorder: "focus:border-amber-500",
  badge: "bg-amber-100 text-amber-700",
  tabActive: "border-amber-500 text-amber-700",
};

export const blueTheme: AccentTheme = {
  bg: "bg-blue-600",
  hover: "hover:bg-blue-700",
  light: "bg-blue-50",
  hoverLight: "hover:bg-blue-50",
  border: "border-blue-400",
  text: "text-blue-700",
  filled: "bg-blue-50 border-2 border-blue-400",
  card: "border-2 border-blue-200 bg-blue-50",
  cardLabel: "text-blue-600",
  cardValue: "text-blue-800",
  focusBorder: "focus:border-blue-500",
  badge: "bg-blue-100 text-blue-700",
  tabActive: "border-blue-600 text-blue-700",
};

export const greenTheme: AccentTheme = {
  bg: "bg-emerald-600",
  hover: "hover:bg-emerald-700",
  light: "bg-emerald-50",
  hoverLight: "hover:bg-emerald-50",
  border: "border-emerald-400",
  text: "text-emerald-700",
  filled: "bg-emerald-50 border-2 border-emerald-400",
  card: "border-2 border-emerald-200 bg-emerald-50",
  cardLabel: "text-emerald-600",
  cardValue: "text-emerald-800",
  focusBorder: "focus:border-emerald-500",
  badge: "bg-emerald-100 text-emerald-700",
  tabActive: "border-emerald-600 text-emerald-700",
};

export const themeFor = (kind: DbKind): AccentTheme =>
  kind === "avant" ? amberTheme : kind === "apres" ? blueTheme : greenTheme;

export const labelFor = (kind: DbKind): string =>
  kind === "avant" ? "Hors Gaïa" : kind === "apres" ? "Après Gaïa" : "Entreprises";

export const prefixFor = (kind: DbKind): "HG" | "GA" | "EN" =>
  kind === "avant" ? "HG" : kind === "apres" ? "GA" : "EN";
