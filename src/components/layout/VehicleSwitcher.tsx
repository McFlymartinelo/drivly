import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { BrandEntry } from "../../brands/catalog"
import { resolveBrand } from "../../brands/resolve"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import { uid } from "../../utils/cn"
import { formatKm } from "../../utils/format"
import { BrandLogo } from "../shared/BrandLogo"
import { BrandPicker } from "../shared/BrandPicker"

export function VehicleSwitcher({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { vehicles, vehicleId, setVehicleId } = useApp()
  const [creating, setCreating] = useState(false)
  const [nom, setNom] = useState("")
  const [brand, setBrand] = useState<BrandEntry | null>(null)
  const navigate = useNavigate()

  if (!open) return null

  async function addVehicle() {
    const name = nom.trim()
    if (!name) return
    const inferred = brand ?? resolveBrand(name)
    const marque = inferred?.name ?? (name.split(" ")[0] ?? name)
    const modele = inferred
      ? name
      : name.split(" ").slice(1).join(" ") || name
    const displayName = inferred ? `${inferred.name} ${name}`.trim() : name
    const id = uid()
    await db.vehicles.add({
      id,
      nom: displayName,
      marque,
      modele,
      immatriculation: "",
      kmInitial: 0,
      kmActuel: 0,
      carburantDefaut: "Diesel",
      capaciteReservoir: 50,
      createdAt: new Date().toISOString(),
    })
    setVehicleId(id)
    setNom("")
    setBrand(null)
    setCreating(false)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fermer" />
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-2xl">
        <p className="mb-3 text-sm font-bold text-ink">Véhicules</p>
        <div className="space-y-2">
          {vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${
                v.id === vehicleId ? "bg-teal-soft" : "bg-app"
              }`}
              onClick={() => {
                setVehicleId(v.id)
                onClose()
              }}
            >
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-white p-1.5 text-teal shadow-sm">
                <BrandLogo marque={v.marque} className="h-7 w-7" />
              </span>
              <span>
                <span className="block font-semibold">{v.marque || v.nom}</span>
                <span className="block text-xs text-muted">
                  {v.nom} · {formatKm(v.kmActuel)}
                </span>
              </span>
            </button>
          ))}
        </div>
        {creating ? (
          <div className="mt-3 space-y-2">
            <BrandPicker value={brand} onChange={setBrand} />
            <div className="flex gap-2">
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={brand ? "Modèle (ex. C4)" : "Nom du véhicule"}
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <button
                type="button"
                onClick={() => void addVehicle()}
                className="rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 w-full rounded-lg bg-teal py-2.5 text-sm font-semibold text-white"
            onClick={() => setCreating(true)}
          >
            Ajouter un véhicule
          </button>
        )}
        <button
          type="button"
          className="mt-2 w-full py-2 text-sm text-muted"
          onClick={() => {
            onClose()
            navigate("/plus")
          }}
        >
          Gérer
        </button>
      </div>
    </div>
  )
}
