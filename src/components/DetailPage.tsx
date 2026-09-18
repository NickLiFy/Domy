import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Bus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns2,
  Fuel,
  ImageOff,
  LayoutGrid,
  MapPin,
  RefreshCw,
  School,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  accessSnapshotVersion,
  fuelConsumptionPer100Km,
  fuelSourceUrl,
  routeLabels,
  routeSnapshotVersion,
} from '../config/app'
import type { FuelStatus } from '../hooks/useFuelPrices'
import { formatCrimeDate, formatDecimal, formatPrice, splitDescription } from '../lib/format'
import { scoreLabel } from '../lib/score'
import { Link } from '../router/Router'
import { catalogPath } from '../router/paths'
import type { AddressSettings, DataSource, FuelType, Home, RefreshSource } from '../types/home'
import { AccessGroup } from './AccessGroup'
import { RouteRow } from './RouteRow'

type GalleryKind = 'standard' | 'ai'
type GalleryLayout = 'grid' | 'column'

type DetailPageProps = {
  home: Home
  fuelPrice: number
  fuelType: FuelType
  fuelStatus: FuelStatus
  addressSettings: AddressSettings
  score: number
  onRefreshListing: (homeId: string) => Promise<Home | null>
  onRefreshSafety: (homeId: string) => Promise<Home | null>
  onRefreshAccess: (homeId: string) => Promise<Home | null>
  onRefreshRoutes: (homeId: string) => Promise<Home | null>
  onRefreshFuel: () => Promise<void>
  refreshingSources: RefreshSource[]
}

export function DetailPage({
  home,
  fuelPrice,
  fuelType,
  fuelStatus,
  addressSettings,
  score,
  onRefreshListing,
  onRefreshSafety,
  onRefreshAccess,
  onRefreshRoutes,
  onRefreshFuel,
  refreshingSources,
}: DetailPageProps) {
  const [galleryKind, setGalleryKind] = useState<GalleryKind>('standard')
  const [galleryLayout, setGalleryLayout] = useState<GalleryLayout>('grid')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showCrimeCases, setShowCrimeCases] = useState(false)
  const [showDescription, setShowDescription] = useState(false)
  const accessSnapshotReady = Boolean(home.accessSnapshotAt && home.accessSnapshotVersion === accessSnapshotVersion)
  const [showAllPhotos, setShowAllPhotos] = useState(false)
  const lightbox = useRef<HTMLDialogElement>(null)

  const photos = galleryKind === 'standard' ? home.images : home.aiImages
  const visiblePhotos = showAllPhotos ? photos : photos.slice(0, 4)
  const hasAiImages = home.aiImages.length > 0
  const descriptionParagraphs = splitDescription(home.description)
  const hasLongDescription = descriptionParagraphs.length > 2 || home.description.length > 320
  const warnings = home.dataWarnings ?? []

  useEffect(() => {
    const dialog = lightbox.current
    if (lightboxIndex === null) dialog?.close()
    else dialog?.showModal()
    return () => dialog?.close()
  }, [lightboxIndex])

  const stepPhoto = (step: number) => {
    setLightboxIndex((current) =>
      current === null ? current : (current + step + photos.length) % photos.length,
    )
  }

  const switchGallery = (kind: GalleryKind) => {
    setGalleryKind(kind)
    setLightboxIndex(null)
    setShowAllPhotos(false)
  }

  const mapDestination = encodeURIComponent(`${home.title}, ${home.location}`)
  const routeAddresses = home.routeAddresses ?? addressSettings
  const fuelCost = Math.round((home.pragueKm / 100) * fuelConsumptionPer100Km * fuelPrice)
  const heroImage = home.images[home.coverMain] ?? home.images[0]
  const sourceEntries: DataSource[] = [
    home.sources?.listing ?? { label: 'Původní nabídka', url: home.listingUrl, note: 'Cena a parametry domu' },
    home.sources?.access ?? { label: 'Dostupnost lokality', url: home.listingUrl, note: 'Školka, obchod a doprava' },
    home.sources?.distance ?? {
      label: 'Mapy.com',
      url: `https://mapy.com/zakladni?q=${mapDestination}`,
      note: 'Jednorázově uložené silniční trasy',
    },
    home.sources?.safety ?? {
      label: 'Mapa kriminality Policie ČR',
      url: home.crime?.sourceUrl ?? 'https://kriminalita.policie.gov.cz/',
      note: 'Veřejný zdroj kriminality',
    },
    { label: 'mBenzin.cz', url: fuelSourceUrl, note: 'Aktuální cena paliva' },
  ]

  return (
    <div className="detail-shell">
      <a className="skip-link" href="#detail-content">Přejít na obsah</a>
      <header className="topbar detail-topbar">
        <Link className="brand" to={catalogPath()}>DOMY<span>.</span></Link>
        <div className="detail-breadcrumb"><MapPin size={15} aria-hidden="true" />{home.location}</div>
        <Link className="back-link" to={catalogPath()}><ArrowLeft size={16} aria-hidden="true" /> Zpět na katalog</Link>
      </header>

      <main className="detail-main" id="detail-content">
        <section className="detail-hero">
          <div className="detail-hero-photo">
            {heroImage ? (
              <button type="button" className="hero-photo-button" onClick={() => setLightboxIndex(home.images.indexOf(heroImage))}>
                <img src={heroImage} alt={`${home.title}, hlavní fotografie`} />
                <span className="hero-photo-hint">Zvětšit fotografii</span>
              </button>
            ) : (
              <div className="empty-media">
                {home.dataStatus === 'loading' ? <RefreshCw size={30} className="is-spinning" aria-hidden="true" /> : <ImageOff size={30} aria-hidden="true" />}
                <span>{home.dataStatus === 'loading' ? 'Načítám fotografii z nabídky' : 'Fotografie nabídky nejsou dostupné'}</span>
              </div>
            )}
            <span className="detail-hero-tag">{home.status}</span>
          </div>
          <div className="detail-hero-copy">
            <h1>{home.title}</h1>
            <p className="detail-location"><MapPin size={15} aria-hidden="true" /> {home.location} {home.year > 0 && <><span className="location-separator">·</span> {home.year}</>}</p>
            <div className="detail-price-line">
              {home.price > 0 ? (
                <><strong>{formatPrice(home.price)}</strong><span>cena z nabídky</span></>
              ) : (
                <strong>Cena čeká na doplnění</strong>
              )}
            </div>
            <div className="detail-hero-score">
              <span className="detail-score-value">{score > 0 ? score.toFixed(1).replace('.', ',') : '—'}<small>/10</small></span>
              <div><strong>{score > 0 ? scoreLabel(score) : 'Skóre není dostupné'}</strong><span>{score > 0 ? 'Podle vašich priorit v katalogu' : 'Doplnit data pro skóre'}</span></div>
            </div>
            <div className={`detail-description ${showDescription || !hasLongDescription ? 'is-expanded' : ''}`}>
              {descriptionParagraphs.map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}
            </div>
            {hasLongDescription && (
              <button className="description-toggle" type="button" onClick={() => setShowDescription((current) => !current)} aria-expanded={showDescription}>
                {showDescription ? 'Skrýt zbytek popisu' : 'Zobrazit celý popis'}
                {showDescription ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
              </button>
            )}
            {home.dataStatus === 'error' && home.dataError && (
              <div className="data-warning-banner" role="alert"><TriangleAlert size={16} aria-hidden="true" /><p>{home.dataError}</p></div>
            )}
            {warnings.length > 0 && (
              <div className="data-warning-banner" role="status">
                <TriangleAlert size={16} aria-hidden="true" />
                <div>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>
              </div>
            )}
            <div className="detail-hero-actions">
              <a className="primary-action" href={home.listingUrl} target="_blank" rel="noreferrer">Původní nabídka <ArrowUpRight size={16} aria-hidden="true" /></a>
              <a className="secondary-action" href={`https://www.google.com/maps/dir/?api=1&destination=${mapDestination}`} target="_blank" rel="noreferrer">Trasa v mapě <ArrowUpRight size={16} aria-hidden="true" /></a>
              <button className="tertiary-action" type="button" onClick={() => void onRefreshListing(home.id)} disabled={refreshingSources.includes('listing')}>
                <RefreshCw size={15} className={refreshingSources.includes('listing') ? 'is-spinning' : ''} aria-hidden="true" />
                {refreshingSources.includes('listing') ? 'Načítám nabídku' : 'Obnovit nabídku'}
              </button>
            </div>
          </div>
        </section>

        <div className="detail-grid">
          <div className="detail-left">
            <section className="gallery-section">
              <div className="gallery-heading">
                <div>
                  <span className="eyebrow">{galleryKind === 'standard' ? 'FOTOGRAFIE Z NABÍDKY' : 'KONCEPT PROSTORU'}</span>
                  <h2>{galleryKind === 'standard' ? 'Jak dům vypadá dnes' : 'Jak by mohl dům působit'}</h2>
                </div>
                <div className="gallery-layout-toggle" role="group" aria-label="Rozložení galerie">
                  <button className={galleryLayout === 'grid' ? 'is-active' : ''} type="button" onClick={() => setGalleryLayout('grid')} aria-pressed={galleryLayout === 'grid'} title="Mřížka" aria-label="Zobrazit v mřížce"><LayoutGrid size={17} aria-hidden="true" /></button>
                  <button className={galleryLayout === 'column' ? 'is-active' : ''} type="button" onClick={() => setGalleryLayout('column')} aria-pressed={galleryLayout === 'column'} title="Sloupec" aria-label="Zobrazit ve sloupci"><Columns2 size={17} aria-hidden="true" /></button>
                </div>
              </div>
              <div className="gallery-switcher" role="group" aria-label="Přepnout fotografie">
                <button className={galleryKind === 'standard' ? 'is-active' : ''} type="button" onClick={() => switchGallery('standard')} aria-pressed={galleryKind === 'standard'}>
                  Z nabídky <small>{home.images.length}</small>
                </button>
                <button className={`${galleryKind === 'ai' ? 'is-active' : ''} ${hasAiImages ? '' : 'is-missing'}`} type="button" onClick={() => switchGallery('ai')} aria-pressed={galleryKind === 'ai'}>
                  <Sparkles size={15} aria-hidden="true" /> AI vizualizace <small>{hasAiImages ? home.aiImages.length : 'chybí'}</small>
                </button>
              </div>
              {galleryKind === 'ai' && hasAiImages && <p className="ai-disclaimer"><Sparkles size={16} aria-hidden="true" /> Ilustrační vizualizace. Nejde o skutečný stav interiéru.</p>}
              {galleryKind === 'ai' && !hasAiImages && (
                <div className="ai-empty-state" role="alert">
                  <TriangleAlert size={20} aria-hidden="true" />
                  <div>
                    <strong>AI vizualizace nebyly přidány</strong>
                    <p>Pro tento dům zatím nejsou vložené vaše AI obrázky. Přidejte je ručně v katalogu přes správu nabídek.</p>
                    <Link className="text-link" to={catalogPath({ editMode: true })}>Otevřít správu nabídek <ArrowUpRight size={14} aria-hidden="true" /></Link>
                  </div>
                </div>
              )}
              {galleryKind === 'standard' && !photos.length && (
                <div className="gallery-empty-state">
                  {home.dataStatus === 'loading' ? <RefreshCw size={26} className="is-spinning" aria-hidden="true" /> : <ImageOff size={26} aria-hidden="true" />}
                  <span>{home.dataStatus === 'loading' ? 'Načítám fotografie z nabídky.' : 'Fotografie nabídky nejsou dostupné.'}</span>
                </div>
              )}
              {visiblePhotos.length > 0 && (
                <div className={`detail-gallery ${galleryLayout}`}>
                  {visiblePhotos.map((src, index) => (
                    <button
                      className="gallery-photo"
                      type="button"
                      key={src}
                      onClick={() => setLightboxIndex(index)}
                      aria-label={`Zvětšit ${galleryKind === 'standard' ? 'fotografii' : 'AI vizualizaci'} ${index + 1} z ${photos.length}`}
                    >
                      <img src={src} alt={`${home.title}, ${galleryKind === 'standard' ? 'fotografie' : 'AI vizualizace'} ${index + 1}`} loading={index > 1 ? 'lazy' : 'eager'} decoding="async" />
                      <span className="gallery-photo-index">{String(index + 1).padStart(2, '0')}</span>
                    </button>
                  ))}
                </div>
              )}
              {photos.length > 4 && (
                <button className="gallery-expand-button" type="button" onClick={() => setShowAllPhotos((current) => !current)} aria-expanded={showAllPhotos}>
                  {showAllPhotos ? 'Skrýt další fotografie' : `Zobrazit všech ${photos.length} fotografií`}
                  {showAllPhotos ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                </button>
              )}
            </section>

            <section className="route-detail-section">
              <div className="detail-section-heading">
                <div><span className="eyebrow">ČAS JE TAKÉ CENA</span><h2>Dojezdy, které se počítají</h2></div>
                <button className="panel-refresh-button" type="button" onClick={() => void onRefreshRoutes(home.id)} disabled={refreshingSources.includes('routes') || (Boolean(home.routesFrozenAt) && home.routesSnapshotVersion === routeSnapshotVersion)}>
                  <RefreshCw size={14} className={refreshingSources.includes('routes') ? 'is-spinning' : ''} aria-hidden="true" />
                  {refreshingSources.includes('routes') ? 'Načítám' : home.routesFrozenAt && home.routesSnapshotVersion === routeSnapshotVersion ? 'Zmrazeno' : 'Načíst dojezdy'}
                </button>
                <span className="heading-note">jednorázově uložené · Mapy.com</span>
              </div>
              <div className="route-table">
                <RouteRow label={routeLabels.work} destination={routeAddresses.work} journey={home.routes.work} distanceKm={home.routeDistances?.work} />
                <RouteRow label={routeLabels.wife} destination={routeAddresses.wife} journey={home.routes.wife} distanceKm={home.routeDistances?.wife} />
                <RouteRow label={routeLabels.prague} destination={routeAddresses.prague} journey={home.routes.prague} distanceKm={home.routeDistances?.prague} highlight />
                <RouteRow label={`Centrum ${home.municipality}`} destination={routeAddresses.center} journey={home.routes.center} distanceKm={home.routeDistances?.center} />
                <RouteRow label={routeLabels.sapa} destination={routeAddresses.sapa} journey={home.routes.sapa} distanceKm={home.routeDistances?.sapa} />
              </div>
              <div className="route-footer-note">
                <span>Přesnější trasa se dopočítá podle času odjezdu v mapové aplikaci.</span>
                <a href={`https://mapy.com/zakladni?q=${mapDestination}`} target="_blank" rel="noreferrer">Mapy.com <ArrowUpRight size={14} aria-hidden="true" /></a>
              </div>
            </section>
          </div>

          <aside className="detail-right">
            <section className="detail-side-panel facts-panel">
              <div className="detail-section-heading compact-heading"><div><span className="eyebrow">V KOSTCE</span><h2>Parametry</h2></div></div>
              <div className="parameter-grid">
                <div><span>Užitná plocha</span><strong>{home.area > 0 ? `${home.area} m²` : '—'}</strong></div>
                <div><span>Pozemek</span><strong>{home.plot > 0 ? `${home.plot} m²` : '—'}</strong></div>
                <div><span>Dispozice</span><strong>{home.rooms}</strong></div>
                <div><span>Postaveno</span><strong>{home.year > 0 ? home.year : '—'}</strong></div>
              </div>
            </section>

            {home.facts && home.facts.length > 0 && (
              <section className="detail-side-panel listing-facts-panel">
                <div className="detail-section-heading compact-heading"><div><span className="eyebrow">Z NABÍDKY</span><h2>Ostatní údaje</h2></div></div>
                <div className="listing-facts-list">
                  {home.facts.map((fact) => (
                    <div className="listing-fact" key={`${fact.label}-${fact.value}`}>
                      <span>{fact.label}</span><strong>{fact.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="detail-side-panel access-panel">
              <div className="detail-section-heading compact-heading">
                <div><span className="eyebrow">KAŽDODENNÍ ŽIVOT</span><h2>Dostupnost</h2></div>
                <button className="panel-refresh-button" type="button" onClick={() => void onRefreshAccess(home.id)} disabled={refreshingSources.includes('access') || accessSnapshotReady}>
                  <RefreshCw size={14} className={refreshingSources.includes('access') ? 'is-spinning' : ''} aria-hidden="true" />
                  {refreshingSources.includes('access') ? 'Načítám' : accessSnapshotReady ? 'Zmrazeno' : 'Načíst okolí'}
                </button>
                <span className="access-score">{home.dataStatus === 'ready' ? 'Mapy.com + OSM' : 'načítám'}</span>
              </div>
              <div className="access-groups">
                <AccessGroup icon={<Bus size={15} aria-hidden="true" />} iconClass="transit-symbol" label="Doprava" places={home.access.transit} emptyLabel="Zastávka v okolí nenalezena" />
                <AccessGroup icon={<School size={15} aria-hidden="true" />} label="Školka / škola" places={home.access.schools} emptyLabel="Školka ani škola v okolí nenalezena" />
                <AccessGroup icon={<ShoppingBasket size={15} aria-hidden="true" />} label="Obchody" places={home.access.shops} emptyLabel="Obchod v okolí nenalezen" />
              </div>
            </section>

            <section className="detail-side-panel safety-panel">
              <div className="detail-section-heading compact-heading">
                <div><span className="eyebrow">POLICIE / OBEC</span><h2>Bezpečnost</h2></div>
                <button className="panel-refresh-button" type="button" onClick={() => void onRefreshSafety(home.id)} disabled={refreshingSources.includes('safety')}>
                  <RefreshCw size={14} className={refreshingSources.includes('safety') ? 'is-spinning' : ''} aria-hidden="true" />
                  {refreshingSources.includes('safety') ? 'Načítám' : 'Obnovit kriminalitu'}
                </button>
                <span className="safety-pill"><ShieldCheck size={14} aria-hidden="true" /> {home.safety.level}</span>
              </div>
              <div className="safety-count-row"><strong>{home.crime?.count ?? '—'}</strong><span>{home.crime ? `případů v okruhu ${home.crime.radiusKm} km` : 'případy nejsou dostupné'}</span></div>
              <p><strong>{home.safety.detail}</strong>. Policie uvádí pouze přibližnou oblast, nikoli přesné místo případu.</p>
              {home.crime && (
                <>
                  <button className="crime-toggle" type="button" onClick={() => setShowCrimeCases((current) => !current)} aria-expanded={showCrimeCases}>
                    {showCrimeCases ? 'Skrýt popisy případů' : `Zobrazit popisy případů (${home.crime.cases.length})`}
                    {showCrimeCases ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                  </button>
                  {showCrimeCases && (
                    <div className="crime-cases">
                      {home.crime.cases.map((crimeCase) => (
                        <article className="crime-case" key={crimeCase.id}>
                          <div className="crime-case-heading"><strong>{crimeCase.description}</strong><span>{crimeCase.distanceKm} km</span></div>
                          <p>{formatCrimeDate(crimeCase.date)} · {crimeCase.stateLabel}</p>
                          <small>Případ {crimeCase.id}. Zobrazená oblast je z důvodu ochrany soukromí pouze orientační.</small>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
              <a className="text-link" href={home.crime?.sourceUrl ?? 'https://kriminalita.policie.gov.cz/download'} target="_blank" rel="noreferrer">Ověřit data policie <ArrowUpRight size={14} aria-hidden="true" /></a>
            </section>

            <section className="detail-side-panel fuel-detail-panel">
              <div className="detail-section-heading compact-heading">
                <div><span className="eyebrow">AUTO / {fuelType.toUpperCase()}</span><h2>Co stojí cesta</h2></div>
                <button className="panel-refresh-button" type="button" onClick={() => void onRefreshFuel()} disabled={refreshingSources.includes('fuel')}>
                  <RefreshCw size={14} className={refreshingSources.includes('fuel') ? 'is-spinning' : ''} aria-hidden="true" />
                  {refreshingSources.includes('fuel') ? 'Načítám' : 'Obnovit palivo'}
                </button>
                <Fuel className="fuel-detail-icon" size={19} aria-hidden="true" />
              </div>
              {home.pragueKm > 0 && fuelStatus === 'live' ? (
                <>
                  <div className="fuel-detail-value"><strong>{fuelCost} Kč</strong><span>odhad paliva do Prahy</span></div>
                  <p>Počítáno z {home.pragueKm} km, spotřeby {formatDecimal(fuelConsumptionPer100Km)} l / 100 km a ceny {formatDecimal(fuelPrice)} Kč / l.</p>
                  <p className="data-status-note">Cena je načtená živě z mBenzin.cz.</p>
                </>
              ) : home.pragueKm > 0 ? (
                <>
                  <div className="fuel-detail-value"><strong>—</strong><span>cena paliva není dostupná</span></div>
                  <p>Silniční trasa do Prahy má {home.pragueKm} km. Výpočet ceny čeká na živou cenu paliva.</p>
                </>
              ) : (
                <>
                  <div className="fuel-detail-value"><strong>—</strong><span>trasa čeká na doplnění</span></div>
                  <p>Vzdálenost do Prahy zatím není u této nabídky doplněná.</p>
                </>
              )}
              <a className="text-link" href={fuelSourceUrl} target="_blank" rel="noreferrer">Zdroj ceny paliva <ArrowUpRight size={14} aria-hidden="true" /></a>
            </section>

            <section className="detail-side-panel sources-panel">
              <div className="detail-section-heading compact-heading">
                <div><span className="eyebrow">ODKUD DATA JSOU</span><h2>Zdroje</h2></div>
                <span className="source-date">{home.verifiedAt ? `ověřeno ${home.verifiedAt}` : 'ověřit před rozhodnutím'}</span>
              </div>
              <div className="source-list">
                {sourceEntries.map((source) => (
                  <a className="source-item" href={source.url} target="_blank" rel="noreferrer" key={source.label}>
                    <span><strong>{source.label}</strong><small>{source.note}</small></span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
      <dialog
        className="photo-lightbox"
        ref={lightbox}
        aria-label="Prohlížeč fotografií"
        onCancel={() => setLightboxIndex(null)}
        onClick={(event) => {
          if (event.target === lightbox.current) setLightboxIndex(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setLightboxIndex(null)
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault()
            stepPhoto(1)
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            stepPhoto(-1)
          }
        }}
      >
        {lightboxIndex !== null && photos[lightboxIndex] && (
          <div className="lightbox-inner">
            <div className="lightbox-bar">
              <span>{lightboxIndex + 1} / {photos.length}</span>
              <button className="icon-button" type="button" onClick={() => setLightboxIndex(null)} aria-label="Zavřít prohlížeč" title="Zavřít prohlížeč"><X size={20} aria-hidden="true" /></button>
            </div>
            <img src={photos[lightboxIndex]} alt={`${home.title}, ${galleryKind === 'standard' ? 'fotografie' : 'AI vizualizace'} ${lightboxIndex + 1}`} />
            {photos.length > 1 && (
              <div className="lightbox-nav">
                <button type="button" onClick={() => stepPhoto(-1)} aria-label="Předchozí fotografie" title="Předchozí fotografie"><ChevronLeft size={22} aria-hidden="true" /></button>
                <button type="button" onClick={() => stepPhoto(1)} aria-label="Další fotografie" title="Další fotografie"><ChevronRight size={22} aria-hidden="true" /></button>
              </div>
            )}
          </div>
        )}
      </dialog>
      <footer className="app-footer detail-footer">
        <span>DOMY. / detail nabídky</span>
        <span>Standardní fotografie a AI koncept jsou vždy oddělené.</span>
      </footer>
    </div>
  )
}
