"""Clés de compte Après Gaïa : anciennes (4 à 8 chiffres) et actuelles (14 chiffres).

Une clé actuelle est construite à partir de l'ancienne ainsi :

    [préfixe][zéros de remplissage][ancienne clé][suite de 0 à MAX_SUFFIX chiffres]

    préfixe 1 = compte normal, préfixe 7 = cabine publique, longueur totale 14.

    ex. 70093981100001 = 7 | 00 | 939811 | 00001   (cabine, ancienne clé 939811)

⚠ Hypothèse à confirmer avec des paires (ancienne clé → clé actuelle) réelles :
la longueur exacte de la « suite » (partie ajoutée après l'ancienne clé). Le
code ne DEVINE donc jamais une ancienne clé : il cherche toutes les clés
actuelles compatibles avec la saisie, et l'agent choisit dans la liste. Quand
la règle sera confirmée, il suffira d'ajuster MAX_SUFFIX / OLD_KEY_* ici.

On ne « retire pas les zéros » pour comparer : on cherche des PLAGES de valeurs
exactes (indexables sur la clé primaire), donc un zéro réel n'est jamais
confondu avec un zéro de remplissage — au pire, les deux comptes sont proposés.
"""
from __future__ import annotations

NEW_KEY_LENGTH = 14
PREFIX_KINDS = {"1": "normale", "7": "cabine"}
OLD_KEY_MIN_DIGITS = 4
OLD_KEY_MAX_DIGITS = 8
MAX_SUFFIX = 6


def key_kind(n: int) -> str:
    """'normale' | 'cabine' pour une clé de 14 chiffres, sinon 'ancienne'."""
    s = str(n)
    if len(s) == NEW_KEY_LENGTH and s[0] in PREFIX_KINDS:
        return PREFIX_KINDS[s[0]]
    return "ancienne"


def new_key_ranges(old_key: str) -> list[tuple[int, int]]:
    """Plages [bas, haut] (bornes incluses) de toutes les clés de 14 chiffres
    pouvant contenir `old_key` : préfixe + zéros + old_key + suite quelconque."""
    old = old_key.strip().lstrip("0")
    if not old.isdigit() or not (OLD_KEY_MIN_DIGITS <= len(old) <= OLD_KEY_MAX_DIGITS):
        return []

    ranges: list[tuple[int, int]] = []
    for prefix in PREFIX_KINDS:
        for suffix_len in range(MAX_SUFFIX + 1):
            zeros = NEW_KEY_LENGTH - 1 - len(old) - suffix_len
            if zeros < 0:
                continue
            low = int(prefix + "0" * zeros + old) * 10**suffix_len
            ranges.append((low, low + 10**suffix_len - 1))
    return ranges
