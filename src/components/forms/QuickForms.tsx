import { Banknote, CalendarClock, Car, Gauge, MapPin, StickyNote, Wrench } from "lucide-react"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import {
  EXPENSE_CATEGORIES,
  INTERVENTION_TYPES,
  REMINDER_TYPES,
  REVENUE_CATEGORIES,
  type ExpenseCategory,
  type InterventionType,
  type ReminderType,
  type RevenueCategory,
} from "../../types"
import { uid } from "../../utils/cn"
import { toDateInputValue, toTimeInputValue, parseDecimal } from "../../utils/format"
import { raiseOdometer } from "../../utils/odometer"
import { showError } from "../../utils/toast"
import { FormRow, UnderlineField, UnderlineSelect } from "../shared/Form"
import { OverlayScreen, SaveBar } from "../shared/OverlayScreen"

function useNow() {
  const now = new Date()
  return {
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 5),
  }
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time || "12:00"}`).toISOString()
}

function useEntry<T extends { id: string }>(items: T[], id: string | undefined) {
  return id ? items.find((item) => item.id === id) : undefined
}

/**
 * Complète un champ numérique avec la valeur par défaut dès qu'elle est
 * disponible (les données IndexedDB arrivent après le premier rendu), sans
 * jamais écraser une saisie de l'utilisateur.
 */
function useHydratedNumber(
  value: number | undefined,
  setValue: (value: string) => void,
  enabled = true,
) {
  const touched = useRef(false)

  useEffect(() => {
    if (!enabled || touched.current) return
    if (value == null || value <= 0) return
    setValue(String(value))
  }, [enabled, value, setValue])

  return () => {
    touched.current = true
  }
}


export function ExpenseForm() {
  const { id } = useParams<{ id: string }>()
  const { vehicle, expenses } = useApp()
  const existing = useEntry(expenses, id)
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [categorie, setCategorie] = useState<ExpenseCategory>("Péage")
  const [montant, setMontant] = useState("")
  const [km, setKm] = useState(String(vehicle?.kmActuel ?? ""))
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(toDateInputValue(existing.date))
    setTime(toTimeInputValue(existing.date))
    setCategorie(existing.categorie)
    setMontant(String(existing.montant).replace(".", ","))
    setKm(existing.kilometrage != null ? String(existing.kilometrage) : "")
    setNotes(existing.notes)
  }, [existing])

  const touchKm = useHydratedNumber(vehicle?.kmActuel, setKm, !existing)

  const amount = parseDecimal(montant)
  const canSave = amount != null && !saving && (!id || Boolean(existing))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle || amount == null || !canSave) return
    setSaving(true)
    const kilometrage = parseDecimal(km)
    try {
      await db.expenses.put({
        id: existing?.id ?? uid(),
        vehicleId: existing?.vehicleId ?? vehicle.id,
        date: toIso(date, time),
        kilometrage: kilometrage != null ? Math.round(kilometrage) : undefined,
        categorie,
        montant: amount,
        notes,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      })
      await raiseOdometer(existing?.vehicleId ?? vehicle.id, kilometrage)
      if (existing) navigate(-1)
      else navigate("/")
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={existing ? "Modifier la dépense" : "Dépense"}
      footer={<SaveBar disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<Car className="h-5 w-5" />}>
        <UnderlineField label="Véhicule" value={vehicle ? `${vehicle.marque} (${vehicle.nom})` : ""} readOnly />
      </FormRow>
      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <UnderlineField label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </FormRow>
      <FormRow icon={<Banknote className="h-5 w-5" />}>
        <UnderlineSelect label="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value as ExpenseCategory)}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </UnderlineSelect>
      </FormRow>
      <FormRow icon={<Banknote className="h-5 w-5" />}>
        <UnderlineField label="Montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
        {amount == null ? <p className="mt-1 text-[12px] text-muted">Montant requis.</p> : null}
      </FormRow>
      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <UnderlineField label="Compteur kilométrique" inputMode="numeric" value={km} onChange={(e) => { touchKm(); setKm(e.target.value) }} />
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function RevenueForm() {
  const { id } = useParams<{ id: string }>()
  const { vehicle, revenues } = useApp()
  const existing = useEntry(revenues, id)
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [categorie, setCategorie] = useState<RevenueCategory>("Remboursement")
  const [montant, setMontant] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(toDateInputValue(existing.date))
    setTime(toTimeInputValue(existing.date))
    setCategorie(existing.categorie)
    setMontant(String(existing.montant).replace(".", ","))
    setNotes(existing.notes)
  }, [existing])

  const amount = parseDecimal(montant)
  const canSave = amount != null && !saving && (!id || Boolean(existing))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle || amount == null || !canSave) return
    setSaving(true)
    try {
      await db.revenues.put({
        id: existing?.id ?? uid(),
        vehicleId: existing?.vehicleId ?? vehicle.id,
        date: toIso(date, time),
        categorie,
        montant: amount,
        notes,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      })
      if (existing) navigate(-1)
      else navigate("/")
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={existing ? "Modifier le revenu" : "Le revenu"}
      color="teal"
      footer={<SaveBar color="teal" disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<Car className="h-5 w-5" />}>
        <UnderlineField label="Véhicule" value={vehicle ? `${vehicle.marque} (${vehicle.nom})` : ""} readOnly />
      </FormRow>
      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <UnderlineField label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </FormRow>
      <FormRow icon={<Banknote className="h-5 w-5" />}>
        <UnderlineSelect label="Catégorie" value={categorie} onChange={(e) => setCategorie(e.target.value as RevenueCategory)}>
          {REVENUE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </UnderlineSelect>
      </FormRow>
      <FormRow icon={<Banknote className="h-5 w-5" />}>
        <UnderlineField label="Montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} />
        {amount == null ? <p className="mt-1 text-[12px] text-muted">Montant requis.</p> : null}
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function MaintenanceForm() {
  const { id } = useParams<{ id: string }>()
  const { vehicle, maintenances } = useApp()
  const existing = useEntry(maintenances, id)
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [km, setKm] = useState(String(vehicle?.kmActuel ?? ""))
  const [typeIntervention, setType] = useState<InterventionType>("Garage")
  const [typeEntretien, setTypeEntretien] = useState("Vidange")
  const [cout, setCout] = useState("")
  const [pieces, setPieces] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(toDateInputValue(existing.date))
    setTime(toTimeInputValue(existing.date))
    setKm(existing.kilometrage > 0 ? String(existing.kilometrage) : "")
    setType(existing.typeIntervention)
    setTypeEntretien(existing.typeEntretien)
    setCout(existing.coutTotal ? String(existing.coutTotal).replace(".", ",") : "")
    setPieces(existing.referencesPieces)
    setNotes(existing.notes)
  }, [existing])

  const touchKm = useHydratedNumber(vehicle?.kmActuel, setKm, !existing)

  const kmValue = parseDecimal(km) ?? 0
  const canSave =
    typeEntretien.trim().length > 0 && kmValue > 0 && !saving && (!id || Boolean(existing))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle || !canSave) return
    setSaving(true)
    try {
      await db.maintenances.put({
        id: existing?.id ?? uid(),
        vehicleId: existing?.vehicleId ?? vehicle.id,
        date: toIso(date, time),
        kilometrage: Math.round(kmValue),
        typeIntervention,
        typeEntretien: typeEntretien.trim(),
        coutTotal: parseDecimal(cout) ?? 0,
        referencesPieces: pieces,
        notes,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      })
      await raiseOdometer(existing?.vehicleId ?? vehicle.id, kmValue)
      if (existing) navigate(-1)
      else navigate("/")
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={existing ? "Modifier l'entretien" : "Entretien"}
      footer={<SaveBar disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<Car className="h-5 w-5" />}>
        <UnderlineField label="Véhicule" value={vehicle ? `${vehicle.marque} (${vehicle.nom})` : ""} readOnly />
      </FormRow>
      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <UnderlineField label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </FormRow>
      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <UnderlineField label="Compteur kilométrique" inputMode="numeric" value={km} onChange={(e) => { touchKm(); setKm(e.target.value) }} />
        {kmValue <= 0 ? <p className="mt-1 text-[12px] text-muted">Kilométrage requis.</p> : null}
      </FormRow>
      <FormRow icon={<Wrench className="h-5 w-5" />}>
        <UnderlineField label="Type d'intervention" value={typeEntretien} onChange={(e) => setTypeEntretien(e.target.value)} />
      </FormRow>
      <FormRow icon={<Wrench className="h-5 w-5" />}>
        <UnderlineSelect label="DIY / Garage" value={typeIntervention} onChange={(e) => setType(e.target.value as InterventionType)}>
          {INTERVENTION_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </UnderlineSelect>
      </FormRow>
      <FormRow icon={<Banknote className="h-5 w-5" />}>
        <UnderlineField label="Coût total" inputMode="decimal" value={cout} onChange={(e) => setCout(e.target.value)} />
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Références pièces" value={pieces} onChange={(e) => setPieces(e.target.value)} />
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function ReminderForm() {
  const { id } = useParams<{ id: string }>()
  const { vehicle, reminders } = useApp()
  const existing = useEntry(reminders, id)
  const navigate = useNavigate()
  const [titre, setTitre] = useState("Plein suivant")
  const [type, setType] = useState<ReminderType>("plein")
  const [km, setKm] = useState("")
  const [date, setDate] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setTitre(existing.titre)
    setType(existing.type)
    setKm(existing.kmEcheance != null ? String(existing.kmEcheance) : "")
    setDate(existing.dateEcheance ? toDateInputValue(existing.dateEcheance) : "")
    setNotes(existing.notes ?? "")
  }, [existing])

  const canSave =
    titre.trim().length > 0 &&
    (parseDecimal(km) != null || date.length > 0) &&
    !saving &&
    (!id || Boolean(existing))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle || !canSave) return
    setSaving(true)
    try {
      await db.reminders.put({
        id: existing?.id ?? uid(),
        vehicleId: existing?.vehicleId ?? vehicle.id,
        titre: titre.trim(),
        type,
        kmEcheance: parseDecimal(km) != null ? Math.round(parseDecimal(km)!) : undefined,
        dateEcheance: date ? new Date(`${date}T08:00`).toISOString() : undefined,
        resolu: existing?.resolu ?? false,
        notes,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      })
      navigate("/rappels")
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={existing ? "Modifier le rappel" : "Rappel"}
      color="teal"
      footer={<SaveBar color="teal" disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      </FormRow>
      <FormRow icon={<Wrench className="h-5 w-5" />}>
        <UnderlineSelect label="Type" value={type} onChange={(e) => setType(e.target.value as ReminderType)}>
          {REMINDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </UnderlineSelect>
      </FormRow>
      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <UnderlineField label="Km d'échéance" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
      </FormRow>
      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <UnderlineField label="Date d'échéance" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function ReadingForm() {
  const { id } = useParams<{ id: string }>()
  const { vehicle, readings } = useApp()
  const existing = useEntry(readings, id)
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [km, setKm] = useState(String(vehicle?.kmActuel ?? ""))
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(toDateInputValue(existing.date))
    setTime(toTimeInputValue(existing.date))
    setKm(String(existing.kilometrage))
    setNotes(existing.notes)
  }, [existing])

  const touchKm = useHydratedNumber(vehicle?.kmActuel, setKm, !existing)

  const kmValue = parseDecimal(km) ?? 0
  const canSave = kmValue > 0 && !saving && (!id || Boolean(existing))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle || !canSave) return
    setSaving(true)
    try {
      await db.readings.put({
        id: existing?.id ?? uid(),
        vehicleId: existing?.vehicleId ?? vehicle.id,
        date: toIso(date, time),
        kilometrage: Math.round(kmValue),
        notes,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      })
      await raiseOdometer(existing?.vehicleId ?? vehicle.id, kmValue)
      if (existing) navigate(-1)
      else navigate("/")
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={existing ? "Modifier le relevé" : "Relevé"}
      footer={<SaveBar disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <UnderlineField label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </FormRow>
      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <UnderlineField label="Compteur kilométrique" inputMode="numeric" value={km} onChange={(e) => { touchKm(); setKm(e.target.value) }} />
        {kmValue <= 0 ? <p className="mt-1 text-[12px] text-muted">Kilométrage requis.</p> : null}
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function TripForm() {
  const { id } = useParams<{ id: string }>()
  const { vehicle, trips } = useApp()
  const existing = useEntry(trips, id)
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [debut, setDebut] = useState(String(vehicle?.kmActuel ?? ""))
  const [fin, setFin] = useState("")
  const [dest, setDest] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setDate(toDateInputValue(existing.date))
    setTime(toTimeInputValue(existing.date))
    setDebut(String(existing.kmDebut))
    setFin(String(existing.kmFin))
    setDest(existing.destination)
    setNotes(existing.notes)
  }, [existing])

  const touchDebut = useHydratedNumber(vehicle?.kmActuel, setDebut, !existing)

  const debutValue = parseDecimal(debut) ?? 0
  const finValue = parseDecimal(fin) ?? 0
  const canSave =
    finValue > 0 && finValue >= debutValue && !saving && (!id || Boolean(existing))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle || !canSave) return
    setSaving(true)
    try {
      await db.trips.put({
        id: existing?.id ?? uid(),
        vehicleId: existing?.vehicleId ?? vehicle.id,
        date: toIso(date, time),
        kmDebut: Math.round(debutValue),
        kmFin: Math.round(finValue),
        destination: dest,
        notes,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      })
      await raiseOdometer(existing?.vehicleId ?? vehicle.id, finValue)
      if (existing) navigate(-1)
      else navigate("/")
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={existing ? "Modifier l'itinéraire" : "Itinéraire"}
      color="teal"
      footer={<SaveBar color="teal" disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <UnderlineField label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </FormRow>
      <FormRow icon={<MapPin className="h-5 w-5" />}>
        <UnderlineField label="Destination" value={dest} onChange={(e) => setDest(e.target.value)} />
      </FormRow>
      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField label="Km début" inputMode="numeric" value={debut} onChange={(e) => { touchDebut(); setDebut(e.target.value) }} />
          <UnderlineField label="Km fin" inputMode="numeric" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
        {finValue > 0 && finValue < debutValue ? (
          <p className="mt-1 text-[12px] text-danger">
            Le compteur d'arrivée doit être supérieur au départ.
          </p>
        ) : null}
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function ChecklistForm() {
  const { id } = useParams<{ id: string }>()
  const { vehicle, checklists } = useApp()
  const existing = useEntry(checklists, id)
  const navigate = useNavigate()
  const [titre, setTitre] = useState("Contrôle avant départ")
  const [raw, setRaw] = useState("Pression des pneus\nNiveaux\nÉclairage")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setTitre(existing.titre)
    setRaw(
      (Array.isArray(existing.items) ? existing.items : [])
        .map((item) => item.label)
        .join("\n"),
    )
  }, [existing])

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  const canSave = titre.trim().length > 0 && lines.length > 0 && !saving && (!id || Boolean(existing))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle || !canSave) return
    setSaving(true)
    try {
      await db.checklists.put({
        id: existing?.id ?? uid(),
        vehicleId: existing?.vehicleId ?? vehicle.id,
        titre: titre.trim(),
        date: existing?.date ?? new Date().toISOString(),
        items: lines.map((label) => {
          const previousItems = Array.isArray(existing?.items) ? existing.items : []
          const previous = previousItems.find((item) => item.label === label)
          return { id: previous?.id ?? uid(), label, done: previous?.done ?? false }
        }),
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      })
      if (existing) navigate(-1)
      else navigate("/")
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={existing ? "Modifier la liste" : "Liste de contrôle"}
      color="teal"
      footer={<SaveBar color="teal" disabled={!canSave} onSubmit={(e) => void save(e)} />}
    >
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      </FormRow>
      <div className="px-4 py-3">
        <label className="block text-[12px] text-muted" htmlFor="checklist-items">
          Éléments (un par ligne)
        </label>
        <textarea
          id="checklist-items"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="mt-1 h-40 w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-teal"
        />
        {lines.length === 0 ? (
          <p className="mt-1 text-[12px] text-muted">Ajoutez au moins un élément.</p>
        ) : null}
      </div>
    </OverlayScreen>
  )
}
