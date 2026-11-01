import {
  Binoculars,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Gauge,
  Info,
  Pencil,
  Trash2,
  User,
  Wallet,
} from "lucide-react"
import type { ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import { computeRefuelingStats } from "../../utils/calculations"
import {
  formatIsoDateTime,
  formatKm,
  formatLitres,
  formatMoney,
} from "../../utils/format"
import { recomputeOdometer } from "../../utils/odometer"
import { showToast } from "../../utils/toast"
import { Card } from "../shared/Form"
import { FuelCan, SectionLabel } from "../shared/Icons"
import { OverlayScreen } from "../shared/OverlayScreen"

export function RefuelingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { vehicle, refuelings } = useApp()
  const fill = refuelings.find((f) => f.id === id)
  const ordered = [...refuelings].sort((a, b) => a.date.localeCompare(b.date))
  const index = ordered.findIndex((f) => f.id === id)

  if (!fill) {
    return (
      <OverlayScreen title="Plein">
        <p className="p-6 text-sm text-muted">Plein introuvable.</p>
      </OverlayScreen>
    )
  }

  const stats = computeRefuelingStats(fill, refuelings, vehicle)
  const fillId = fill.id
  const snapshot = fill
  const vehicleId = fill.vehicleId

  async function remove() {
    try {
      await db.refuelings.delete(fillId)
      await recomputeOdometer(vehicleId)
      navigate("/", { replace: true })
      showToast("Plein supprimé.", {
        actionLabel: "Annuler",
        duration: 7000,
        onAction: () => {
          void db.refuelings
            .put(snapshot)
            .then(() => recomputeOdometer(vehicleId))
            .then(() => showToast("Suppression annulée.", { tone: "success" }))
        },
      })
    } catch (error) {
      console.error(error)
      showToast("Suppression impossible.", { tone: "error" })
    }
  }

  function go(delta: number) {
    const next = ordered[index + delta]
    if (next) navigate(`/plein/${next.id}`, { replace: true })
  }

  return (
    <OverlayScreen
      title="Plein"
      right={
        <>
          <button type="button" aria-label="Supprimer" className="grid h-11 w-11 place-items-center" onClick={() => void remove()}>
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Modifier"
            className="grid h-11 w-11 place-items-center"
            onClick={() => navigate(`/plein/${fill.id}/edit`)}
          >
            <Pencil className="h-5 w-5" />
          </button>
        </>
      }
    >
      <div className="bg-teal px-4 pb-4">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Précédent" onClick={() => go(-1)} className="text-white disabled:opacity-30" disabled={index <= 0}>
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white/20 py-2 text-[13px] font-medium text-white">
            {formatIsoDateTime(fill.date)}
          </div>
          <button type="button" aria-label="Suivant" onClick={() => go(1)} className="text-white disabled:opacity-30" disabled={index < 0 || index >= ordered.length - 1}>
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="space-y-4 bg-app px-4 py-4 pb-10">
        <div>
          <SectionLabel>Valeurs</SectionLabel>
          <Card className="px-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                icon={<Gauge className="h-4 w-4 text-muted" />}
                label="Compteur kilométrique"
                value={formatKm(fill.kilometrage)}
              />
              <Metric
                icon={<Binoculars className="h-4 w-4 text-muted" />}
                label="Distance"
                value={stats.distance != null ? formatKm(stats.distance) : "N/A"}
              />
            </div>
            <div className="mt-4 border-t border-line pt-4 text-center">
              <p className="text-[13px] text-muted">Coût total</p>
              <p className="text-[28px] font-bold text-teal">{formatMoney(fill.coutTotal)}</p>
            </div>
          </Card>
        </div>

        <Card className="px-4 py-4">
          <p className="text-[15px] font-bold text-teal">{fill.carburant}</p>
          <div className="mt-3 grid grid-cols-3 text-center text-[13px]">
            <div>
              <p className="text-muted">Prix / L</p>
              <p className="mt-1 font-semibold">{formatMoney(fill.prixAuLitre)}</p>
            </div>
            <div>
              <p className="text-muted">Coût total</p>
              <p className="mt-1 font-semibold">{formatMoney(fill.coutTotal)}</p>
            </div>
            <div>
              <p className="text-muted">Le volume</p>
              <p className="mt-1 font-semibold">{formatLitres(fill.litres)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-start justify-between border-t border-line pt-4">
            <div className="space-y-2 text-[13px]">
              <p>
                <span className="text-muted">Achevée </span>
                <span className="font-semibold">{fill.pleinComplet ? "Oui" : "Non"}</span>
              </p>
              <p>
                <span className="text-muted">Consommation </span>
                <span className="font-semibold">
                  {stats.consommation != null ? `${stats.consommation.toFixed(2).replace(".", ",")} L/100km` : "N/A"}
                </span>
                <Info className="ml-1 inline h-3.5 w-3.5 text-muted" />
              </p>
              <p>
                <span className="text-muted">Coût / Km </span>
                <span className="font-semibold">
                  {stats.coutParKm != null ? formatMoney(stats.coutParKm) : "N/A"}
                </span>
              </p>
            </div>
            <div className="text-center">
              <p className="mb-1 text-[11px] text-muted">% du réservoir</p>
              <FuelCan percent={stats.pourcentageReservoir ?? 0} className="mx-auto h-[88px] w-[72px]" />
            </div>
          </div>
          {fill.pleinComplet &&
          stats.distance != null &&
          stats.consommation == null ? (
            <p className="mt-3 border-t border-line pt-2 text-[11px] leading-snug text-muted">
              Consommation incohérente ignorée : plein partiel ou relevé manquant.
            </p>
          ) : null}
        </Card>

        <div>
          <SectionLabel>Détails</SectionLabel>
          <Card className="divide-y divide-line">
            <div className="flex items-center gap-3 px-4 py-3">
              <Fuel className="h-5 w-5 text-muted" />
              <div>
                <p className="text-[12px] text-muted">Station service</p>
                <p className="font-semibold">{fill.station || "—"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-line">
              <div className="flex items-center gap-3 px-4 py-3">
                <Wallet className="h-5 w-5 text-muted" />
                <div>
                  <p className="text-[12px] text-muted">Mode de paiement</p>
                  <p className="font-semibold">{fill.modePaiement || "\u00a0"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <User className="h-5 w-5 text-muted" />
                <div>
                  <p className="text-[12px] text-muted">Conducteur</p>
                  <p className="font-semibold">{fill.conducteur || "\u00a0"}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </OverlayScreen>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[12px] text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-[16px] font-bold">{value}</p>
    </div>
  )
}
