import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import type { NearbyPlace } from '../types/home'

type AccessGroupProps = {
  icon: ReactNode
  label: string
  places: NearbyPlace[]
  emptyLabel: string
  iconClass?: string
}

const mapUrlForPlace = (place: NearbyPlace) => {
  if (place.sourceUrl) return place.sourceUrl

  if (place.coordinates) {
    const lat = place.coordinates.lat.toFixed(6)
    const lon = place.coordinates.lon.toFixed(6)
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`
  }

  return `https://mapy.com/zakladni?q=${encodeURIComponent(place.name)}`
}

const mapLabelForPlace = (place: NearbyPlace) =>
  place.sourceUrl?.includes('openstreetmap.org') || place.coordinates ? 'OpenStreetMap' : 'Mapy.com'

export function AccessGroup({ icon, label, places, emptyLabel, iconClass = '' }: AccessGroupProps) {
  return (
    <div className="access-group">
      <div className="access-group-heading">
        <span className={`access-icon ${iconClass}`}>{icon}</span>
        <strong>{label}</strong>
      </div>
      {places.length ? (
        <ul className="access-group-list">
          {places.map((place) => (
            <li key={`${place.name}-${place.distanceKm}`}>
              <a
                className="access-place-link"
                href={mapUrlForPlace(place)}
                target="_blank"
                rel="noreferrer"
                title={`Otevřít ${place.name} na ${mapLabelForPlace(place)}`}
              >
                <span>{place.name}</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <b>
                {typeof place.walkMinutes === 'number'
                  ? `${place.distanceKm} km · ${place.walkMinutes} min pěšky`
                  : `${place.distanceKm} km vzdušně · pěší trasa nezjištěna`}
              </b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="access-empty">{emptyLabel}</p>
      )}
    </div>
  )
}
