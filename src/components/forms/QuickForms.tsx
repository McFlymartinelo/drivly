import { Banknote, CalendarClock, Car, Gauge, MapPin, StickyNote, Wrench } from "lucide-react"
import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
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
import { parseDecimal } from "../../utils/format"
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

export function ExpenseForm() {
  const { vehicle } = useApp()
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [categorie, setCategorie] = useState<ExpenseCategory>("Péage")
  const [montant, setMontant] = useState("")
  const [km, setKm] = useState(String(vehicle?.kmActuel ?? ""))
  const [notes, setNotes] = useState("")

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    const amount = parseDecimal(montant)
    if (amount == null) return
    await db.expenses.add({
      id: uid(),
      vehicleId: vehicle.id,
      date: toIso(date, time),
      kilometrage: Number(km) || undefined,
      categorie,
      montant: amount,
      notes,
      createdAt: new Date().toISOString(),
    })
    navigate("/")
  }

  return (
    <OverlayScreen title="Dépense" footer={<SaveBar onSubmit={(e) => void save(e)} />}>
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
      </FormRow>
      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <UnderlineField label="Compteur kilométrique" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function RevenueForm() {
  const { vehicle } = useApp()
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [categorie, setCategorie] = useState<RevenueCategory>("Remboursement")
  const [montant, setMontant] = useState("")
  const [notes, setNotes] = useState("")

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    const amount = parseDecimal(montant)
    if (amount == null) return
    await db.revenues.add({
      id: uid(),
      vehicleId: vehicle.id,
      date: toIso(date, time),
      categorie,
      montant: amount,
      notes,
      createdAt: new Date().toISOString(),
    })
    navigate("/")
  }

  return (
    <OverlayScreen title="Le revenu" color="teal" footer={<SaveBar color="teal" onSubmit={(e) => void save(e)} />}>
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
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function MaintenanceForm() {
  const { vehicle } = useApp()
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

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    const amount = parseDecimal(cout) ?? 0
    await db.maintenances.add({
      id: uid(),
      vehicleId: vehicle.id,
      date: toIso(date, time),
      kilometrage: Number(km) || 0,
      typeIntervention,
      typeEntretien,
      coutTotal: amount,
      referencesPieces: pieces,
      notes,
      createdAt: new Date().toISOString(),
    })
    navigate("/")
  }

  return (
    <OverlayScreen title="Entretien" footer={<SaveBar onSubmit={(e) => void save(e)} />}>
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
        <UnderlineField label="Compteur kilométrique" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
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
  const { vehicle } = useApp()
  const navigate = useNavigate()
  const [titre, setTitre] = useState("Plein suivant")
  const [type, setType] = useState<ReminderType>("plein")
  const [km, setKm] = useState("")
  const [date, setDate] = useState("")
  const [notes, setNotes] = useState("")

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    await db.reminders.add({
      id: uid(),
      vehicleId: vehicle.id,
      titre,
      type,
      kmEcheance: km ? Number(km) : undefined,
      dateEcheance: date ? new Date(`${date}T08:00`).toISOString() : undefined,
      resolu: false,
      notes,
      createdAt: new Date().toISOString(),
    })
    navigate("/rappels")
  }

  return (
    <OverlayScreen title="Rappel" color="teal" footer={<SaveBar color="teal" onSubmit={(e) => void save(e)} />}>
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
  const { vehicle } = useApp()
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [km, setKm] = useState(String(vehicle?.kmActuel ?? ""))
  const [notes, setNotes] = useState("")

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    const k = Number(km)
    await db.readings.add({
      id: uid(),
      vehicleId: vehicle.id,
      date: toIso(date, time),
      kilometrage: k,
      notes,
      createdAt: new Date().toISOString(),
    })
    if (k > vehicle.kmActuel) await db.vehicles.update(vehicle.id, { kmActuel: k })
    navigate("/")
  }

  return (
    <OverlayScreen title="Relevé" footer={<SaveBar onSubmit={(e) => void save(e)} />}>
      <FormRow icon={<CalendarClock className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <UnderlineField label="Heure" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </FormRow>
      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <UnderlineField label="Compteur kilométrique" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function TripForm() {
  const { vehicle } = useApp()
  const navigate = useNavigate()
  const init = useNow()
  const [date, setDate] = useState(init.date)
  const [time, setTime] = useState(init.time)
  const [debut, setDebut] = useState(String(vehicle?.kmActuel ?? ""))
  const [fin, setFin] = useState("")
  const [dest, setDest] = useState("")
  const [notes, setNotes] = useState("")

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    const kmFin = Number(fin)
    await db.trips.add({
      id: uid(),
      vehicleId: vehicle.id,
      date: toIso(date, time),
      kmDebut: Number(debut) || 0,
      kmFin,
      destination: dest,
      notes,
      createdAt: new Date().toISOString(),
    })
    if (kmFin > vehicle.kmActuel) await db.vehicles.update(vehicle.id, { kmActuel: kmFin })
    navigate("/")
  }

  return (
    <OverlayScreen title="Itinéraire" color="teal" footer={<SaveBar color="teal" onSubmit={(e) => void save(e)} />}>
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
          <UnderlineField label="Km début" inputMode="numeric" value={debut} onChange={(e) => setDebut(e.target.value)} />
          <UnderlineField label="Km fin" inputMode="numeric" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
      </FormRow>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormRow>
    </OverlayScreen>
  )
}

export function ChecklistForm() {
  const { vehicle } = useApp()
  const navigate = useNavigate()
  const [titre, setTitre] = useState("Contrôle avant départ")
  const [raw, setRaw] = useState("Pression des pneus\nNiveaux\nÉclairage")

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    await db.checklists.add({
      id: uid(),
      vehicleId: vehicle.id,
      titre,
      date: new Date().toISOString(),
      items: raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((label) => ({ id: uid(), label, done: false })),
      createdAt: new Date().toISOString(),
    })
    navigate("/")
  }

  return (
    <OverlayScreen title="Liste de contrôle" color="teal" footer={<SaveBar color="teal" onSubmit={(e) => void save(e)} />}>
      <FormRow icon={<StickyNote className="h-5 w-5" />}>
        <UnderlineField label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} />
      </FormRow>
      <div className="px-4 py-3">
        <label className="block text-[12px] text-muted">Éléments (un par ligne)</label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="mt-1 h-40 w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-teal"
        />
      </div>
    </OverlayScreen>
  )
}
