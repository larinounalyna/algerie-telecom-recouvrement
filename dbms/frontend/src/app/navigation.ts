// Central navigation/view types for the whole app. Kept separate from
// App.tsx so that pages can depend on this file instead of importing
// from the App component itself (avoids circular / upward imports).

export type View = "root" | "landing" | "hors-gaia" | "apres-gaia" | "entreprises" | "corporate-ar";
