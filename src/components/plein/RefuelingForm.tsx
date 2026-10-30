import {
  Banknote,
  CalendarClock,
  Car,
  Fuel,
  Gauge,
  MapPin,
  User,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import { FUEL_TYPES, PAYMENT_MODES, type FuelType } from "../../types"
import { lastOdometer } from "../../utils/calculations"
import { uid } from "../../utils/cn"
import {
  parseDecimal,
  round2,
  toDateInputValue,
  toTimeInputValue,
} from "../../utils/format"
import { raiseOdometer } from "../../utils/odometer"
import { showError } from "../../utils/toast"
import { FormRow, Toggle, UnderlineField, UnderlineSelect } from "../shared/Form"
import { OverlayScreen, SaveBar } from "../shared/OverlayScreen"

type LastEdited = "price" | "total" | "litres" | null

export function RefuelingForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { vehicle, vehicles, refuelings } = useApp()
  const existing = refuelings.find((f) => f.id === id)
  const isEdit = Boolean(id)

  const lastKm = lastOdometer(refuelings, vehicle?.kmActuel ?? 0)
  const latest = useMemo(
    () =>
      [...refuelings].sort(
        (a, b) => b.date.localeCompare(a.date) || b.kilometrage - a.kilometrage,
      )[0],
    [refuelings],
  )
  const prefilled = useRef(false)
  const kmTouched = useRef(false)

  const [vehicleId, setVehicleId] = useState(vehicle?.id ?? "")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5))
  const [km, setKm] = useState(String(lastKm))
  const [carburant, setCarburant] = useState<FuelType>(
    vehicle?.carburantDefaut ?? "Diesel",
  )
  const [prix, setPrix] = useState("")
  const [total, setTotal] = useState("")
  const [litres, setLitres] = useState("")
  const [full, setFull] = useState(true)
  const [station, setStation] = useState("")
  const [driver, setDriver] = useState("")
  const [payment, setPayment] = useState("")
  const [notes, setNotes] = useState("")
  const [more, setMore] = useState(false)
  const [lastEdited, setLastEdited] = useState<LastEdited>(null)
  const [saving, setSaving] = useState(false)

  // Hydratation en édition (y compris après un rechargement direct de l'URL).
  useEffect(() => {
    if (!existing) return
    setVehicleId(existing.vehicleId)
    setDate(toDateInputValue(existing.date))
    setTime(toTimeInputValue(existing.date))
    setKm(String(existing.kilometrage))
    setCarburant(existing.carburant)
    setPrix(String(existing.prixAuLitre).replace(".", ","))
    setTotal(String(existing.coutTotal).replace(".", ","))
    setLitres(String(existing.litres).replace(".", ","))
    setFull(existing.pleinComplet)
    setStation(existing.station)
    setDriver(existing.conducteur)
    setPayment(existing.modePaiement)
    setNotes(existing.notes)
    setMore(Boolean(existing.notes || existing.modePaiement))
  }, [existing])

  // Pré-remplissage d'un nouveau plein avec le dernier passage : station,
  // prix et mode de paiement sont le plus souvent identiques.
  useEffect(() => {
    if (isEdit || prefilled.current || !latest) return
    prefilled.current = true
    if (latest.station) setStation(latest.station)
    if (latest.modePaiement) setPayment(latest.modePaiement)
    if (latest.carburant) setCarburant(latest.carburant)
    if (latest.prixAuLitre > 0) setPrix(String(latest.prixAuLitre).replace(".", ","))
    if (latest.conducteur) setDriver(latest.conducteur)
  }, [isEdit, latest])

  // Les données IndexedDB arrivent après le premier rendu : on complète le
  // véhicule et le compteur sans écraser une saisie en cours.
  useEffect(() => {
    if (!vehicleId && vehicle) setVehicleId(vehicle.id)
  }, [vehicleId, vehicle])

  useEffect(() => {
    if (isEdit || kmTouched.current) return
    if (lastKm > 0) setKm(String(lastKm))
  }, [isEdit, lastKm])

  useEffect(() => {
    const p = parseDecimal(prix)
    const t = parseDecimal(total)
    const l = parseDecimal(litres)

    if (lastEdited === "total") {
      // Le champ modifié est le total : on complète d'abord les litres si le
      // prix est connu, sinon le prix à partir des litres.
      if (p != null && p > 0 && t != null) {
        setLitres(String(round2(t / p)).replace(".", ","))
      } else if (l != null && l > 0 && t != null) {
        setPrix(String(round2(t / l)).replace(".", ","))
      }
      return
    }

    if (lastEdited === "price" || lastEdited === "litres") {
      if (p != null && l != null) {
        setTotal(String(round2(p * l)).replace(".", ","))
      }
    }
  }, [prix, total, litres, lastEdited])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicle

  const kmValue = parseDecimal(km) ?? 0
  const p = parseDecimal(prix)
  const t = parseDecimal(total)
  const l = parseDecimal(litres)
  const canSave =
    Boolean(vehicleId) &&
    Boolean(date) &&
    kmValue > 0 &&
    p != null &&
    p > 0 &&
    t != null &&
    t > 0 &&
    l != null &&
    l > 0 &&
    !saving &&
    (!isEdit || Boolean(existing))

  const hint = selectedVehicle ? `Dernier compteur ${lastKm} km` : undefined

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!canSave || p == null || t == null || l == null) return
    setSaving(true)
    try {
      const iso = new Date(`${date}T${time || "12:00"}`).toISOString()
      const recordId = existing?.id ?? uid()
      await db.refuelings.put({
        id: recordId,
        vehicleId,
        date: iso,
        kilometrage: Math.round(kmValue),
        litres: l,
        prixAuLitre: p,
        coutTotal: t,
        carburant,
        pleinComplet: full,
        station: station.trim(),
        notes,
        conducteur: driver,
        modePaiement: payment,
        createdAt: existing?.createdAt ?? iso,
      })
      await raiseOdometer(vehicleId, kmValue)
      navigate(`/plein/${recordId}`, { replace: true })
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={isEdit ? "Modifier le plein" : "Plein"}
      footer={<SaveBar disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<Car className="h-5 w-5" />}>
        <UnderlineSelect
          label="Véhicule"
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.marque} ({v.nom})
            </option>
          ))}
        </UnderlineSelect>
      </FormRow>

      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <UnderlineField
            label="Heure"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </FormRow>

      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <UnderlineField
          label="Compteur kilométrique"
          inputMode="numeric"
          value={km}
          hint={hint}
          onChange={(e) => {
            kmTouched.current = true
            setKm(e.target.value)
          }}
        />
        {kmValue <= 0 ? (
          <p className="mt-1 text-[12px] text-muted">Compteur requis.</p>
        ) : null}
      </FormRow>

      <FormRow icon={<Fuel className="h-5 w-5" />}>
        <UnderlineSelect
          label="Carburant"
          value={carburant}
          onChange={(e) => setCarburant(e.target.value as FuelType)}
        >
          {FUEL_TYPES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </UnderlineSelect>
      </FormRow>

      <FormRow icon={<Banknote className="h-5 w-5" />}>
        <div className="grid grid-cols-3 gap-3">
          <UnderlineField
            label="Prix / L"
            inputMode="decimal"
            value={prix}
            onChange={(e) => {
              setLastEdited("price")
              setPrix(e.target.value)
            }}
          />
          <UnderlineField
            label="Coût total"
            inputMode="decimal"
            value={total}
            onChange={(e) => {
              setLastEdited("total")
              setTotal(e.target.value)
            }}
          />
          <UnderlineField
            label="Litres"
            inputMode="decimal"
            value={litres}
            onChange={(e) => {
              setLastEdited("litres")
              setLitres(e.target.value)
            }}
          />
        </div>
        {!canSave && !saving ? (
          <p className="mt-1 text-[11px] text-muted">
            Prix, litres et total sont nécessaires (deux suffisent à calculer le troisième).
          </p>
        ) : null}
      </FormRow>

      <FormRow icon={<Fuel className="h-5 w-5" />}>
        <div className="flex items-center justify-between border-b border-line py-2">
          <span className="text-[14px] text-ink">Vous remplissez le réservoir?</span>
          <Toggle checked={full} onChange={setFull} />
        </div>
      </FormRow>

      <FormRow icon={<MapPin className="h-5 w-5" />}>
        <UnderlineField
          label="Station service"
          value={station}
          onChange={(e) => setStation(e.target.value)}
        />
      </FormRow>

      <FormRow icon={<User className="h-5 w-5" />}>
        <UnderlineField
          label="Conducteur"
          value={driver}
          onChange={(e) => setDriver(e.target.value)}
        />
      </FormRow>

      <button
        type="button"
        className="px-16 py-3 text-left text-[14px] font-medium text-orange"
        onClick={() => setMore((v) => !v)}
      >
        {more ? "− Moins d'options" : "+ Plus d'options"}
      </button>

      {more ? (
        <>
          <FormRow icon={<Banknote className="h-5 w-5" />}>
            <UnderlineSelect
              label="Mode de paiement"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
            >
              <option value="">—</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </UnderlineSelect>
          </FormRow>
          <FormRow icon={<User className="h-5 w-5" />}>
            <UnderlineField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormRow>
        </>
      ) : null}
    </OverlayScreen>
  )
}
