import { ENTRIES } from "./store.mjs"

/**
 * Valide la forme minimale d'une sauvegarde avant écriture. La validation
 * complète (champs, dates) est faite par l'application, ici on protège la base
 * contre les fichiers manifestement invalides.
 */
export function normalizePayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw Object.assign(new Error("Sauvegarde invalide : objet attendu."), { status: 400 })
  }
  if (raw.version !== 1 && raw.version !== 2) {
    throw Object.assign(new Error("Version de sauvegarde non prise en charge."), { status: 400 })
  }
  const payload = { ...raw }
  for (const table of ENTRIES) {
    if (payload[table] == null) payload[table] = []
    if (!Array.isArray(payload[table])) {
      throw Object.assign(new Error(`« ${table} » doit être une liste.`), { status: 400 })
    }
    for (const record of payload[table]) {
      if (!record || typeof record !== "object" || typeof record.id !== "string" || !record.id) {
        throw Object.assign(
          new Error(`Entrée invalide dans « ${table} » : identifiant manquant.`),
          { status: 400 },
        )
      }
    }
  }
  return payload
}
