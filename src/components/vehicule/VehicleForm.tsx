import { Car, Fuel, Gauge, Hash, Info, Tag } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import type { BrandEntry } from "../../brands/catalog"
import { resolveBrand } from "../../brands/resolve"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import { FUEL_TYPES, type FuelType, type Vehicle } from "../../types"
import { uid } from "../../utils/cn"
import { parseDecimal } from "../../utils/format"
import { showError, showToast } from "../../utils/toast"
import { BrandPicker } from "../shared/BrandPicker"
import { FormRow, UnderlineField, UnderlineSelect } from "../shared/Form"
import { OverlayScreen, SaveBar } from "../shared/OverlayScreen"

export function VehicleForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { vehicles, setVehicleId } = useApp()
  const existing = id ? vehicles.find((vehicle) => vehicle.id === id) : undefined
  const isEdit = Boolean(existing)

  const [marque, setMarque] = useState("")
  const [modele, setModele] = useState("")
  const [immatriculation, setImmatriculation] = useState("")
  const [kmInitial, setKmInitial] = useState("0")
  const [kmActuel, setKmActuel] = useState("0")
  const [carburant, setCarburant] = useState<FuelType>("Diesel")
  const [capacite, setCapacite] = useState("50")
  const [brand, setBrand] = useState<BrandEntry | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!existing) return
    setMarque(existing.marque)
    setModele(existing.modele)
    setImmatriculation(existing.immatriculation)
    setKmInitial(String(existing.kmInitial))
    setKmActuel(String(existing.kmActuel))
    setCarburant(existing.carburantDefaut)
    setCapacite(String(existing.capaciteReservoir))
  }, [existing])

  function pickBrand(entry: BrandEntry) {
    setBrand(entry)
    if (!marque) setMarque(entry.name)
  }

  const kmInitialValue = parseDecimal(kmInitial) ?? 0
  const kmActuelValue = parseDecimal(kmActuel) ?? 0
  const capaciteValue = parseDecimal(capacite) ?? 0
  const canSave =
    marque.trim().length > 0 &&
    kmInitialValue >= 0 &&
    kmActuelValue >= kmInitialValue &&
    capaciteValue > 0 &&
    !saving

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setSaving(true)

    const finalMarque = marque.trim()
    const finalModele = modele.trim()
    const inferred = brand ?? resolveBrand(`${finalMarque} ${finalModele}`)
    const nom =
      [finalMarque, finalModele].filter(Boolean).join(" ") ||
      inferred?.name ||
      "Mon véhicule"

    const data: Vehicle = {
      id: existing?.id ?? uid(),
      nom,
      marque: finalMarque,
      modele: finalModele,
      immatriculation: immatriculation.trim().toUpperCase(),
      kmInitial: Math.round(kmInitialValue),
      kmActuel: Math.round(kmActuelValue),
      carburantDefaut: carburant,
      capaciteReservoir: capaciteValue,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }

    try {
      if (existing) {
        await db.vehicles.put({ ...data, photo: existing.photo })
      } else {
        await db.vehicles.add(data)
        setVehicleId(data.id)
      }
      showToast(existing ? "Véhicule mis à jour." : "Véhicule créé.", {
        tone: "success",
      })
      navigate(existing ? "/plus" : "/", { replace: true })
    } catch (error) {
      console.error(error)
      showError()
      setSaving(false)
    }
  }

  return (
    <OverlayScreen
      title={isEdit ? "Modifier le véhicule" : "Nouveau véhicule"}
      color="teal"
      footer={
        <SaveBar
          color="teal"
          label={isEdit ? "ENREGISTRER" : "CRÉER LE VÉHICULE"}
          disabled={!canSave}
          onSubmit={(event) => void save(event)}
        />
      }
    >
      <FormRow icon={<Car className="h-5 w-5" />}>
        <div className="space-y-3">
          <p className="text-[12px] text-muted">Marque</p>
          <BrandPicker value={brand} onChange={pickBrand} />
        </div>
      </FormRow>

      <FormRow icon={<Tag className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField
            label="Marque"
            value={marque}
            onChange={(event) => setMarque(event.target.value)}
            placeholder="Citroën"
          />
          <UnderlineField
            label="Modèle"
            value={modele}
            onChange={(event) => setModele(event.target.value)}
            placeholder="C4"
          />
        </div>
      </FormRow>

      <FormRow icon={<Hash className="h-5 w-5" />}>
        <UnderlineField
          label="Immatriculation"
          value={immatriculation}
          onChange={(event) => setImmatriculation(event.target.value)}
          placeholder="AB-123-CD"
          autoCapitalize="characters"
        />
      </FormRow>

      <FormRow icon={<Gauge className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineField
            label="Km au départ"
            inputMode="numeric"
            value={kmInitial}
            onChange={(event) => setKmInitial(event.target.value)}
          />
          <UnderlineField
            label="Km actuel"
            inputMode="numeric"
            value={kmActuel}
            onChange={(event) => setKmActuel(event.target.value)}
          />
        </div>
        {kmActuelValue < kmInitialValue ? (
          <p className="mt-1 text-[12px] text-[#c62828]">
            Le compteur actuel doit être supérieur au kilométrage de départ.
          </p>
        ) : null}
      </FormRow>

      <FormRow icon={<Fuel className="h-5 w-5" />}>
        <div className="grid grid-cols-2 gap-4">
          <UnderlineSelect
            label="Carburant"
            value={carburant}
            onChange={(event) => setCarburant(event.target.value as FuelType)}
          >
            {FUEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </UnderlineSelect>
          <UnderlineField
            label="Réservoir (L)"
            inputMode="decimal"
            value={capacite}
            onChange={(event) => setCapacite(event.target.value)}
          />
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
          <Info className="h-3 w-3" />
          La capacité sert au calcul du pourcentage de réservoir.
        </p>
      </FormRow>
    </OverlayScreen>
  )
}
