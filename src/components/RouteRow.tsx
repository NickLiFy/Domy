import type { Journey } from '../types/home'

type RouteRowProps = {
  label: string
  destination: string
  journey: Journey
  distanceKm?: number
  highlight?: boolean
}

export function RouteRow({ label, destination, journey, distanceKm = 0, highlight = false }: RouteRowProps) {
  return (
    <div className={`route-table-row ${highlight ? 'is-highlighted' : ''}`}>
      <div className="route-row-label"><strong>{label}</strong><small>{destination || 'adresa není nastavena'}</small></div>
      <span><small>Auto</small>{journey.car}{distanceKm > 0 && <em>{distanceKm} km</em>}</span>
      <span><small>MHD</small>{journey.transit}</span>
      <span><small>Vlak</small>{journey.train}</span>
    </div>
  )
}
