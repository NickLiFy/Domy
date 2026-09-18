import { useState } from 'react'
import { Archive, ArrowRight, Bus, Car, Fuel, Images, ImageOff, MapPin, RefreshCw, ShieldCheck, TrainFront, Trash2 } from 'lucide-react'
import { fuelConsumptionPer100Km } from '../config/app'
import { formatDecimal, formatMillions, formatPrice } from '../lib/format'
import { getCoverImages } from '../lib/home'
import { scoreLabel } from '../lib/score'
import { Link } from '../router/Router'
import { detailPath } from '../router/paths'
import type { Home, RemovalAction } from '../types/home'

type ListingCardProps = {
  home: Home
  rank: number
  score: number
  editMode: boolean
  fuelPrice: number
  onToggleCover: (homeId: string, index: number) => void
  onSetMain: (homeId: string, index: number) => void
  onAddAiFiles: (homeId: string, files: File[]) => void
  onAddAiImageUrl: (homeId: string, imageUrl: string) => boolean
  onRemoveAiImage: (homeId: string, imageIndex: number) => void
  onRequestRemoval: (homeId: string, action: RemovalAction) => void
  onRefreshListing: () => void
  isRefreshing: boolean
}

export function ListingCard({
  home,
  rank,
  score,
  editMode,
  fuelPrice,
  onToggleCover,
  onSetMain,
  onAddAiFiles,
  onAddAiImageUrl,
  onRemoveAiImage,
  onRequestRemoval,
  onRefreshListing,
  isRefreshing,
}: ListingCardProps) {
  const [aiImageUrl, setAiImageUrl] = useState('')
  const [aiUrlError, setAiUrlError] = useState(false)
  const coverImages = getCoverImages(home)
  const fuelCost = Math.round((home.pragueKm / 100) * fuelConsumptionPer100Km * fuelPrice)
  const formattedScore = score.toFixed(1).replace('.', ',')

  return (
    <article className={`listing-card ${editMode ? 'edit-open' : ''}`}>
      <Link className={`listing-cover cover-count-${coverImages.length}`} to={detailPath(home.id)} aria-label={`Zobrazit dům: ${home.title}`}>
        {coverImages.length ? coverImages.map((image, imageIndex) => (
          <div className={`cover-tile cover-tile-${imageIndex}`} key={image.index}>
            <img src={image.src} alt={`${home.title}, fotografie ${image.index + 1}`} loading={rank > 2 ? 'lazy' : 'eager'} decoding="async" />
          </div>
        )) : (
          <div className="cover-empty">
            {home.dataStatus === 'loading' ? <RefreshCw size={28} className="is-spinning" aria-hidden="true" /> : <ImageOff size={28} aria-hidden="true" />}
            <span>{home.dataStatus === 'loading' ? 'Načítám fotografie z nabídky' : 'Fotografie nabídky nejsou dostupné'}</span>
          </div>
        )}
        <span className="photo-count"><Images size={13} aria-hidden="true" /> {home.images.length || 'Bez foto'}</span>
        <span className="listing-rank" aria-label={`Pořadí ${rank}`}>{String(rank).padStart(2, '0')}</span>
      </Link>

      <div className="listing-body">
        <div className="listing-heading">
          <div>
            <span className="listing-status">{home.status}</span>
            <Link className="listing-title" to={detailPath(home.id)}>
              {home.title}
            </Link>
            <span className="listing-location"><MapPin size={14} aria-hidden="true" /> {home.location}</span>
            {home.dataStatus === 'error' && <small className="listing-error">{home.dataError}</small>}
          </div>
          <div className={`score-badge ${score > 0 ? '' : 'score-pending'}`} aria-label={score > 0 ? `Shoda ${formattedScore} z 10` : 'Skóre není dostupné'} title={score > 0 ? `${scoreLabel(score)}: ${formattedScore} z 10` : 'Skóre čeká na doplnění dat'}>
            <span>Shoda</span>
            <strong>{score > 0 ? formattedScore : '—'}<small>/10</small></strong>
          </div>
        </div>

        <div className="listing-price-row">
          {home.price > 0 ? (
            <>
              <strong>{formatMillions(home.price)} Kč</strong>
              <span>{home.area > 0 ? `${formatPrice(Math.round(home.price / home.area))} / m²` : `${formatPrice(home.price)} celkem`}</span>
            </>
          ) : (
            <strong className="unknown-value">Cena čeká na doplnění</strong>
          )}
        </div>

        <div className="home-facts">
          <span><small>Užitná plocha</small><b>{home.area || '—'} m²</b></span>
          <span><small>Pozemek</small><b>{home.plot || '—'} m²</b></span>
          <span><small>Dispozice</small><b>{home.rooms}</b></span>
        </div>

        <div className="card-route">
          <div className="card-route-heading"><span>DO PRAHY</span><small>{home.pragueKm > 0 ? `${home.pragueKm} km · silniční trasa` : 'silniční trasa'}</small></div>
          <div className="card-route-values">
            <span><Car className="route-icon" size={16} aria-hidden="true" /><b>{home.routes.prague.car}</b><small>auto</small></span>
            <span><Bus className="route-icon" size={16} aria-hidden="true" /><b>{home.routes.prague.transit}</b><small>MHD</small></span>
            <span><TrainFront className="route-icon" size={16} aria-hidden="true" /><b>{home.routes.prague.train}</b><small>vlak</small></span>
          </div>
          <div className="fuel-estimate">
            {home.pragueKm > 0 && fuelPrice > 0 ? (
              <><span><Fuel size={13} aria-hidden="true" /> {fuelCost} Kč / cesta</span><small>při {formatDecimal(fuelPrice)} Kč/l</small></>
            ) : home.dataStatus === 'loading' ? (
              <span><Fuel size={13} aria-hidden="true" /> Čekám na výpočet trasy</span>
            ) : (
              <span><Fuel size={13} aria-hidden="true" /> Náklady na cestu nejsou dostupné</span>
            )}
          </div>
        </div>

        <div className="listing-bottom">
          <div className="mini-safety"><ShieldCheck size={14} aria-hidden="true" /> Bezpečnost: <strong>{home.safety.level}</strong></div>
          <button className="card-refresh" type="button" onClick={onRefreshListing} disabled={isRefreshing} aria-label={isRefreshing ? `Načítám nabídku: ${home.title}` : `Obnovit nabídku: ${home.title}`} title={isRefreshing ? 'Načítám nabídku' : 'Obnovit nabídku'}>
            <RefreshCw size={16} className={isRefreshing ? 'is-spinning' : ''} aria-hidden="true" />
          </button>
          <Link className="detail-button" to={detailPath(home.id)}>
            Detail domu <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {editMode && (
          <div className="cover-editor">
            <div className="cover-editor-heading">
              <span>Úvodní fotografie</span>
              <small>{home.coverSelection.length} / 3 vybráno</small>
            </div>
            <div className="cover-picker">
              {home.images.map((src, imageIndex) => {
                const selected = home.coverSelection.includes(imageIndex)
                const main = home.coverMain === imageIndex
                return (
                  <div className="cover-choice" key={src}>
                    <button
                      className={`cover-choice-image ${selected ? 'is-selected' : ''}`}
                      type="button"
                      onClick={() => onToggleCover(home.id, imageIndex)}
                      aria-pressed={selected}
                      title={selected ? 'Odebrat z coveru' : 'Přidat do coveru'}
                    >
                      <img src={src} alt={`Výběr fotografie ${imageIndex + 1}`} />
                      <span>{selected ? '✓' : imageIndex + 1}</span>
                    </button>
                    {selected && (
                      <button
                        className={`main-image-button ${main ? 'is-main' : ''}`}
                        type="button"
                        onClick={() => onSetMain(home.id, imageIndex)}
                        title="Nastavit jako hlavní fotografii"
                      >
                        {main ? '★ hlavní' : '☆ hlavní'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {editMode && (
          <div className="listing-management">
            <div className="cover-editor-heading">
              <span>Správa nabídky</span>
            </div>
            <div className="listing-management-actions">
              <button className="archive-home-button" type="button" onClick={() => onRequestRemoval(home.id, 'archive')}>
                <Archive size={14} aria-hidden="true" /> Archivovat
              </button>
              <button className="delete-home-button" type="button" onClick={() => onRequestRemoval(home.id, 'delete')}>
                <Trash2 size={14} aria-hidden="true" /> Odstranit
              </button>
            </div>
          </div>
        )}
        {editMode && (
          <div className="ai-editor">
            <div className="cover-editor-heading">
              <span>AI vygenerované</span>
              <small className={home.aiImages.length ? '' : 'is-missing'}>
                {home.aiImages.length ? `${home.aiImages.length} vloženo` : 'chybí'}
              </small>
            </div>
            {home.aiImages.length ? (
              <div className="ai-picker">
                {home.aiImages.map((src, imageIndex) => (
                  <div className="ai-choice" key={`${src}-${imageIndex}`}>
                    <img src={src} alt={`${home.title}, AI vizualizace ${imageIndex + 1}`} />
                    <button
                      type="button"
                      onClick={() => onRemoveAiImage(home.id, imageIndex)}
                      aria-label={`Odebrat AI vizualizaci ${imageIndex + 1}`}
                      title="Odebrat AI vizualizaci"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ai-editor-empty">Bez vlastních AI obrázků se v detailu zobrazí červené upozornění.</p>
            )}
            <div className="ai-editor-actions">
              <label className="ai-upload-button">
                <span>+ Nahrát obrázky</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    if (event.target.files) onAddAiFiles(home.id, Array.from(event.target.files))
                    event.target.value = ''
                  }}
                />
              </label>
              <form
                className="ai-url-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  const added = onAddAiImageUrl(home.id, aiImageUrl)
                  setAiUrlError(!added)
                  if (added) setAiImageUrl('')
                }}
              >
                <input
                  type="url"
                  value={aiImageUrl}
                  onChange={(event) => {
                    setAiImageUrl(event.target.value)
                    setAiUrlError(false)
                  }}
                  placeholder="nebo URL obrázku"
                  aria-label="URL AI obrázku"
                />
                <button type="submit">Přidat URL</button>
              </form>
            </div>
            {aiUrlError && <small className="ai-url-error">Vložte platnou URL obrázku.</small>}
          </div>
        )}
      </div>
    </article>
  )
}
