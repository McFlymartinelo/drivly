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
            className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
              vehicle.id === vehicleId ? "bg-teal-soft" : "bg-app"
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
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1.5 text-teal shadow-sm">
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
              className="grid h-9 w-9 place-items-center text-muted"
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
          className="flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 text-[14px] font-semibold text-white"
          onClick={() => {
            onClose()
            navigate("/vehicule/nouveau")
          }}
        >
          <Plus className="h-4 w-4" /> Ajouter un véhicule
        </button>
        <button
          type="button"
          className="w-full py-2 text-sm text-muted"
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
