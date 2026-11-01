/**
 * Logo Drivly : symbole 32 px sur mobile, logo horizontal sur web.
 * La hauteur du logo horizontal (41 px) donne un symbole de 32 px,
 * conformément à la zone de protection ½ H du guide.
 */
export function DrivlyLogo() {
  return (
    <>
      <img
        src="/brand/drivly-symbol.svg"
        alt="Drivly"
        width={31}
        height={32}
        className="drivly-logo-symbol"
      />
      <img
        src="/brand/drivly-logo-horizontal.svg"
        alt="Drivly"
        width={149}
        height={41}
        className="drivly-logo-horizontal"
      />
    </>
  )
}
