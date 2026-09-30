// Communes d'Alger utilisées pour le filtrage régional dans la Base de
// Données (Kouba, Bordj El Kiffan, El Harrach, Hussein Dey, Rouïba).
export const REGIONS = ["Kouba", "Bordj El Kiffan", "El Harrach", "Hussein Dey", "Rouïba"] as const;

export type Region = (typeof REGIONS)[number];
