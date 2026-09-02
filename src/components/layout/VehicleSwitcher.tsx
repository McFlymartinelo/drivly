import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import { uid } from "../../utils/cn"
import { formatKm } from "../../utils/format"
import { CitroenMark } from "../shared/Icons"

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
  const navigate = useNavigate()

  if (!open) return null

  async function addVehicle() {
    const name = nom.trim()
    if (!name) return
    const id = uid()
    await db.vehicles.add({
      id,
      nom: name,
      marque: name.split(" ")[0] ?? name,
      modele: name.split(" ").slice(1).join(" ") || name,
      immatriculation: "",
      kmInitial: 0,
      kmActuel: 0,
      carburantDefaut: "Diesel",
      capaciteReservoir: 50,
      createdAt: new Date().toISOString(),
    })
    setVehicleId(id)
    setNom("")
    setCreating(false)
    onClose()
  }

  return (
    <div className="absolute inset-0 z-50">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fermer" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-2xl">
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
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-teal shadow-sm">
                <CitroenMark className="h-6 w-6" />
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
          <div className="mt-3 flex gap-2">
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du véhicule"
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
