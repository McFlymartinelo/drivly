import { Pencil, Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useApp } from "../../hooks/useApp"
import { formatKm } from "../../utils/format"
import { BrandLogo } from "../shared/BrandLogo"
import { Modal } from "../shared/Modal"

export function VehicleSwitcher({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { vehicles, vehicleId, setVehicleId } = useApp()
  const navigate = useNavigate()

  return (
    <Modal open={open} onClose={onClose} title="Véhicules">
      <div className="space-y-2">
        {vehicles.length === 0 ? (
          <p className="text-sm text-muted">Aucun véhicule enregistré.</p>
        ) : null}
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className={`aura-press flex items-center gap-1 rounded-xl border px-2 py-1.5 transition-colors ${
              vehicle.id === vehicleId
                ? "border-[color-mix(in_oklab,var(--aura-accent)_35%,transparent)] bg-teal-soft"
                : "border-line bg-surface"
            }`}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => {
                setVehicleId(vehicle.id)
                onClose()
              }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[14px] bg-surface-2 p-1.5 text-teal-deep ring-1 ring-black/5">
                <BrandLogo marque={vehicle.marque} className="h-7 w-7" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {vehicle.marque || vehicle.nom}
                </span>
                <span className="block text-xs text-muted">
                  {vehicle.nom} · {formatKm(vehicle.kmActuel)}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Modifier ${vehicle.nom}`}
              className="aura-iconbtn !h-9 !w-9"
              onClick={() => {
                onClose()
                navigate(`/vehicule/${vehicle.id}`)
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          className="aura-btn aura-btn--block"
          onClick={() => {
            onClose()
            navigate("/vehicule/nouveau")
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter un véhicule
        </button>
        <button
          type="button"
          className="aura-btn aura-btn--ghost aura-btn--block !min-h-10 !text-[13px]"
          onClick={() => {
            onClose()
            navigate("/plus")
          }}
        >
          Gérer les véhicules et les données
        </button>
      </div>
    </Modal>
  )
}
