import { Car } from "lucide-react"
import { useState } from "react"
import type { BrandEntry } from "../../brands/catalog"
import { brandLogoUrl, resolveBrand } from "../../brands/resolve"
import { SIMPLE_LOGOS } from "../../brands/simpleLogos"
import { cn } from "../../utils/cn"

export function BrandLogo({
  marque,
  className,
}: {
  marque?: string
  className?: string
}) {
  const brand = resolveBrand(marque ?? "")
  if (!brand) {
    return <Car className={cn("text-teal", className)} aria-hidden />
  }
  return <ResolvedBrandLogo key={brand.slug} brand={brand} className={className} />
}

function ResolvedBrandLogo({
  brand,
  className,
}: {
  brand: BrandEntry
  className?: string
}) {
  const simple = SIMPLE_LOGOS[brand.slug]
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <Car className={cn("text-teal", className)} aria-hidden />
  }

  if (simple) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path d={simple.path} fill={`#${simple.hex}`} />
      </svg>
    )
  }

  return (
    <img
      src={brandLogoUrl(brand.slug)}
      alt=""
      className={cn("object-contain", className)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  )
}
