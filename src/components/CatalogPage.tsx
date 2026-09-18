import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, ArrowUpRight, Check, CheckCheck, Circle, CircleGauge, Fuel, House, Link2, MapPin, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Undo2, X } from 'lucide-react'
import {
  defaultWeights,
  fuelDefaults,
  fuelSourceUrl,
  isSupportedListingUrl,
  routeKeys,
  routeLabels,
  routePlaceholders,
  weightLabels,
} from '../config/app'
import type { FuelStatus } from '../hooks/useFuelPrices'
import { durationInMinutes, formatDecimal } from '../lib/format'
import { createPendingHome } from '../lib/home'
import { homeMetrics, scoreFor } from '../lib/score'
import { Link, navigate } from '../router/Router'
import { catalogPath } from '../router/paths'
import type {
  AddressSettings,
  FuelType,
  Home,
  RefreshSource,
  RemovalAction,
  RouteKey,
  WeightKey,
  Weights,
} from '../types/home'
import { ConfirmDialog } from './ConfirmDialog'
import { ListingCard } from './ListingCard'

type UndoItem = {
  home: Home
  action: RemovalAction
  originalIndex: number
}

type CatalogPageProps = {
  editMode: boolean
  weights: Weights
  setWeights: React.Dispatch<React.SetStateAction<Weights>>
  homes: Home[]
  setHomes: React.Dispatch<React.SetStateAction<Home[]>>
  archivedHomes: Home[]
  setArchivedHomes: React.Dispatch<React.SetStateAction<Home[]>>
  addressSettings: AddressSettings
  setAddressSettings: React.Dispatch<React.SetStateAction<AddressSettings>>
  fuelType: FuelType
  setFuelType: React.Dispatch<React.SetStateAction<FuelType>>
  fuelPrices: Record<FuelType, number>
  fuelStatus: FuelStatus
  fuelMessage: string | null
  onRefreshFuel: () => Promise<void>
  refreshingSources: RefreshSource[]
  onRefreshListing: (homeId: string, fallbackHome?: Home) => Promise<Home | null>
  onRefreshSafety: (homeId: string) => Promise<Home | null>
  onRefreshAccess: (homeId: string) => Promise<Home | null>
}

export function CatalogPage({
  editMode,
  weights,
  setWeights,
  homes,
  setHomes,
  archivedHomes,
  setArchivedHomes,
  addressSettings,
  setAddressSettings,
  fuelType,
  setFuelType,
  fuelPrices,
  fuelStatus,
  fuelMessage,
  onRefreshFuel,
  refreshingSources,
  onRefreshListing,
  onRefreshSafety,
  onRefreshAccess,
}: CatalogPageProps) {
  const [listingUrlInput, setListingUrlInput] = useState('')
  const [addHomeMessage, setAddHomeMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const [priceFilter, setPriceFilter] = useState('all')
  const [commuteFilter, setCommuteFilter] = useState('all')
  const [sort, setSort] = useState('score')
  const [undoStack, setUndoStack] = useState<UndoItem[]>([])
  const [pendingRemoval, setPendingRemoval] = useState<{ homeId: string; action: RemovalAction } | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const [showAddHome, setShowAddHome] = useState(false)
  const addHomeDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = addHomeDialog.current
    if (showAddHome) dialog?.showModal()
    else dialog?.close()
    return () => dialog?.close()
  }, [showAddHome])

  const openAddHome = () => {
    setAddHomeMessage(null)
    setShowAddHome(true)
  }

  const hasActiveFilters = Boolean(query.trim() || priceFilter !== 'all' || commuteFilter !== 'all')
  const resetFilters = () => {
    setQuery('')
    setPriceFilter('all')
    setCommuteFilter('all')
  }

  const filteredHomes = homes
    .filter((home) => {
      const normalizedQuery = query.trim().toLocaleLowerCase('cs-CZ')
      const matchesQuery =
        !normalizedQuery ||
        `${home.title} ${home.location} ${home.municipality}`.toLocaleLowerCase('cs-CZ').includes(normalizedQuery)
      const matchesPrice = priceFilter === 'all' || (home.price > 0 && home.price <= Number(priceFilter))
      const matchesCommute =
        commuteFilter === 'all' ||
        (commuteFilter === 'under40' &&
          Math.min(durationInMinutes(home.routes.prague.car), durationInMinutes(home.routes.prague.train)) <= 40) ||
        (commuteFilter === 'under60' &&
          Math.min(durationInMinutes(home.routes.prague.transit), durationInMinutes(home.routes.prague.train)) <= 60)

      return matchesQuery && matchesPrice && matchesCommute
    })
    .sort((first, second) => {
      if (sort === 'price') return (first.price || Infinity) - (second.price || Infinity)
      if (sort === 'area') return second.area - first.area
      return scoreFor(second, weights, homes) - scoreFor(first, weights, homes)
    })

  const scoredHomes = filteredHomes.filter((home) =>
    Object.values(homeMetrics(home, homes)).some((metric) => metric > 0),
  )
  const averageScore = scoredHomes.length
    ? scoredHomes.reduce((sum, home) => sum + scoreFor(home, weights, homes), 0) / scoredHomes.length
    : 0
  const routeCandidates = filteredHomes
    .map((home) => ({ home, minutes: durationInMinutes(home.routes.prague.car) }))
    .filter((candidate) => Number.isFinite(candidate.minutes))
    .sort((first, second) => first.minutes - second.minutes)
  const fastestRoute = routeCandidates[0]
  const longestRoute = routeCandidates.at(-1)

  const checklistItems = [
    {
      label: 'Cena a parametry',
      detail: 'z originální nabídky',
      done: homes.some((home) => home.dataStatus === 'ready' && home.price > 0),
    },
    {
      label: 'Fotografie a popis',
      detail: 'z originální nabídky',
      done: homes.some((home) => home.dataStatus === 'ready' && home.images.length > 0 && home.description.length > 0),
    },
    {
      label: 'Silniční dojezdy',
      detail: 'Mapy.com · jednorázový snapshot',
      done: homes.some((home) => home.routesKey && home.pragueKm > 0),
    },
    {
      label: 'Kriminalita',
      detail: 'data Policie ČR',
      done: homes.some((home) => home.crime !== null && home.crime !== undefined),
    },
  ]
  const completedChecklistItems = checklistItems.filter((item) => item.done).length

  const updateWeight = (key: WeightKey, value: number) => {
    setWeights((current) => ({ ...current, [key]: value }))
  }

  const updateAddress = (key: RouteKey, value: string) => {
    setAddressSettings((current) => ({ ...current, [key]: value }))
  }

  const toggleEditMode = () => {
    if (editMode) setUndoStack([])
    navigate(catalogPath({ editMode: !editMode }), { replace: true })
  }

  const confirmHomeRemoval = () => {
    if (!pendingRemoval) return

    const homeIndex = homes.findIndex((home) => home.id === pendingRemoval.homeId)
    const home = homeIndex >= 0 ? homes[homeIndex] : undefined
    if (!home) {
      setPendingRemoval(null)
      return
    }

    setUndoStack((current) =>
      [...current, { home, action: pendingRemoval.action, originalIndex: homeIndex }].slice(-10),
    )
    setHomes((current) => current.filter((item) => item.id !== home.id))
    if (pendingRemoval.action === 'archive') {
      setArchivedHomes((current) => [home, ...current.filter((item) => item.id !== home.id)])
    }
    setPendingRemoval(null)
  }

  const undoLastEdit = () => {
    const lastAction = undoStack.at(-1)
    if (!lastAction) return

    setHomes((current) => {
      if (current.some((home) => home.id === lastAction.home.id)) return current
      const insertAt = Math.min(lastAction.originalIndex, current.length)
      return [...current.slice(0, insertAt), lastAction.home, ...current.slice(insertAt)]
    })
    if (lastAction.action === 'archive') {
      setArchivedHomes((current) => current.filter((home) => home.id !== lastAction.home.id))
    }
    setUndoStack((current) => current.slice(0, -1))
  }

  const restoreArchivedHome = (homeId: string) => {
    const home = archivedHomes.find((item) => item.id === homeId)
    if (!home) return

    setArchivedHomes((current) => current.filter((item) => item.id !== homeId))
    setHomes((current) => (current.some((item) => item.id === homeId) ? current : [...current, home]))
  }

  const toggleCoverImage = (homeId: string, index: number) => {
    setHomes((current) =>
      current.map((home) => {
        if (home.id !== homeId) return home
        if (home.coverSelection.includes(index)) {
          const nextSelection = home.coverSelection.filter((item) => item !== index)
          return {
            ...home,
            coverSelection: nextSelection,
            coverMain: home.coverMain === index ? nextSelection[0] ?? home.coverMain : home.coverMain,
          }
        }
        if (home.coverSelection.length >= 3) return home
        return { ...home, coverSelection: [...home.coverSelection, index] }
      }),
    )
  }

  const setCoverMain = (homeId: string, index: number) => {
    setHomes((current) =>
      current.map((home) =>
        home.id === homeId && home.coverSelection.includes(index) ? { ...home, coverMain: index } : home,
      ),
    )
  }

  const addHomeFromLink = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = listingUrlInput.trim()

    if (!isSupportedListingUrl(value)) {
      setAddHomeMessage({ kind: 'error', text: 'Vložte přímý odkaz na detail nabídky z www.eurobydleni.cz.' })
      return
    }

    const normalizedUrl = new URL(value).toString()
    if (homes.some((home) => home.listingUrl === normalizedUrl)) {
      setAddHomeMessage({ kind: 'error', text: 'Tento odkaz už v seznamu je.' })
      return
    }

    const pendingHome = createPendingHome(normalizedUrl)
    setHomes((current) => [...current, pendingHome])
    setListingUrlInput('')
    setShowAddHome(false)
    setAddHomeMessage({
      kind: 'success',
      text: 'Dům byl přidán. Načítám nabídku; okolí a bezpečnost se doplní na pozadí.',
    })

    void onRefreshListing(pendingHome.id, pendingHome).then((loadedHome) => {
      if (!loadedHome) {
        setAddHomeMessage({ kind: 'error', text: 'Nabídku se nepodařilo načíst z veřejného zdroje.' })
        return
      }
      setAddHomeMessage({ kind: 'success', text: 'Údaje nabídky byly načteny. Veřejná data se doplňují na pozadí.' })
      void Promise.all([onRefreshSafety(loadedHome.id), onRefreshAccess(loadedHome.id)])
    })
  }

  const addAiImagesFromFiles = (homeId: string, files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return

    Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              if (typeof reader.result === 'string') resolve(reader.result)
              else reject(new Error('image-read-failed'))
            }
            reader.onerror = () => reject(reader.error ?? new Error('image-read-failed'))
            reader.readAsDataURL(file)
          }),
      ),
    )
      .then((newImages) => {
        setHomes((current) =>
          current.map((home) =>
            home.id === homeId ? { ...home, aiImages: [...home.aiImages, ...newImages] } : home,
          ),
        )
      })
      .catch(() => {
        setAddHomeMessage({ kind: 'error', text: 'AI obrázky se nepodařilo načíst.' })
      })
  }

  const addAiImageUrl = (homeId: string, imageUrl: string) => {
    try {
      const parsedUrl = new URL(imageUrl.trim())
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false
      const normalizedUrl = parsedUrl.toString()
      if (homes.some((home) => home.id === homeId && home.aiImages.includes(normalizedUrl))) return false

      setHomes((current) =>
        current.map((home) =>
          home.id === homeId ? { ...home, aiImages: [...home.aiImages, normalizedUrl] } : home,
        ),
      )
      return true
    } catch {
      return false
    }
  }

  const removeAiImage = (homeId: string, imageIndex: number) => {
    setHomes((current) =>
      current.map((home) =>
        home.id === homeId
          ? { ...home, aiImages: home.aiImages.filter((_, index) => index !== imageIndex) }
          : home,
      ),
    )
  }

  const pendingHome = pendingRemoval ? homes.find((home) => home.id === pendingRemoval.homeId) : undefined

  return (
    <div className="app-shell">
      <a className="skip-link" href="#catalog-results">Přejít na nabídky</a>
      <header className="topbar">
        <Link className="brand" to={catalogPath()}>
          DOMY<span>.</span>
        </Link>
        <div className="topbar-context">
          <MapPin size={15} aria-hidden="true" />
          <span>Praha a okolí</span>
        </div>
        <div className="topbar-actions">
          <button
            className={`edit-toggle ${editMode ? 'is-active' : ''}`}
            type="button"
            onClick={toggleEditMode}
            aria-pressed={editMode}
          >
            {editMode ? <Check size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
            {editMode ? 'Hotovo' : 'Spravovat'}
          </button>
          <button className="catalog-primary" type="button" onClick={openAddHome}>
            <Plus size={17} aria-hidden="true" /> Přidat dům
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="catalog-intro">
          <div>
            <div className="eyebrow">VÁŠ VÝBĚR / PRAHA A OKOLÍ</div>
            <h1>Domy v hledáčku<span className="catalog-total">{homes.length}</span></h1>
          </div>
          <div className="catalog-overview" aria-label="Souhrn filtrovaných nabídek">
            <div><CircleGauge size={18} aria-hidden="true" /><span>Průměrná shoda<strong>{averageScore ? averageScore.toFixed(1).replace('.', ',') : '—'} <small>/ 10</small></strong></span></div>
            <div><MapPin size={18} aria-hidden="true" /><span>Nejkratší dojezd autem<strong>{fastestRoute ? `${fastestRoute.minutes} min` : '—'}</strong></span></div>
          </div>
        </section>

        <section className="filterbar" aria-label="Filtry katalogu">
          <label className="search-field">
            <Search size={19} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hledat lokalitu nebo dům"
              aria-label="Hledat lokalitu nebo dům"
            />
          </label>
          <label className="select-field">
            <span className="field-caption">Rozpočet</span>
            <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
              <option value="all">Bez limitu</option>
              <option value="10000000">Do 10 mil. Kč</option>
              <option value="13000000">Do 13 mil. Kč</option>
              <option value="15000000">Do 15 mil. Kč</option>
            </select>
          </label>
          <label className="select-field">
            <span className="field-caption">Dojezd do Prahy</span>
            <select value={commuteFilter} onChange={(event) => setCommuteFilter(event.target.value)}>
              <option value="all">Bez limitu</option>
              <option value="under40">40 min autem / vlakem</option>
              <option value="under60">60 min MHD / vlakem</option>
            </select>
          </label>
          <label className="select-field sort-field">
            <span className="field-caption">Řadit podle</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="score">Nejlepší shoda</option>
              <option value="price">Nejnižší cena</option>
              <option value="area">Největší prostor</option>
            </select>
          </label>
        </section>

        <div className="catalog-toolbar">
          <div className="catalog-result-count" role="status" aria-live="polite" aria-atomic="true">
            <strong>{filteredHomes.length}</strong> z {homes.length} nabídek
            {hasActiveFilters && <button className="reset-filters" type="button" onClick={resetFilters}><X size={14} aria-hidden="true" /> Zrušit filtry</button>}
          </div>
          <button className={`preferences-toggle ${showPreferences ? 'is-active' : ''}`} type="button" onClick={() => setShowPreferences((current) => !current)} aria-expanded={showPreferences} aria-controls="catalog-preferences">
            <SlidersHorizontal size={16} aria-hidden="true" /> Moje priority
          </button>
        </div>

        {addHomeMessage && !showAddHome && (
          <div className={`catalog-notice ${addHomeMessage.kind}`} role={addHomeMessage.kind === 'error' ? 'alert' : 'status'}>
            <span>{addHomeMessage.text}</span>
            <button className="icon-button" type="button" aria-label="Zavřít oznámení" title="Zavřít oznámení" onClick={() => setAddHomeMessage(null)}><X size={17} aria-hidden="true" /></button>
          </div>
        )}

        {showPreferences && (
          <section className="edit-panel" id="catalog-preferences" aria-label="Moje priority">
            <div className="edit-panel-heading">
              <div>
                <div className="eyebrow accent-eyebrow">HODNOCENÍ NABÍDEK</div>
                <h2>Na čem vám záleží</h2>
              </div>
              <button className="preferences-reset" type="button" onClick={() => setWeights(defaultWeights)}><Undo2 size={15} aria-hidden="true" /> Výchozí váhy</button>
            </div>
            <div className="weight-grid">
              {(Object.keys(weightLabels) as WeightKey[]).map((key) => (
                <label className="weight-control" key={key}>
                  <span>
                    <strong>{weightLabels[key]}</strong>
                    <output>{weights[key]}</output>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="70"
                    step="5"
                    value={weights[key]}
                    onChange={(event) => updateWeight(key, Number(event.target.value))}
                    style={{ '--range-progress': `${(weights[key] / 70) * 100}%` } as React.CSSProperties}
                  />
                </label>
              ))}
            </div>
            <div className="address-editor">
              <div className="address-editor-heading">
                <div>
                  <div className="eyebrow accent-eyebrow">CÍLOVÉ BODY</div>
                  <h3>Adresy pro výpočet dojezdů</h3>
                </div>
              </div>
              <div className="address-grid">
                {routeKeys.map((key) => (
                  <label key={key}>
                    <span>{routeLabels[key]}</span>
                    <input
                      type="text"
                      value={addressSettings[key]}
                      onChange={(event) => updateAddress(key, event.target.value)}
                      placeholder={routePlaceholders[key]}
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>
        )}

        {editMode && (
          <section className="management-panel" aria-label="Správa nabídek">
            <div className="management-heading"><Pencil size={16} aria-hidden="true" /><strong>Správa nabídek</strong><span>Archiv: {archivedHomes.length}</span></div>
            {archivedHomes.length > 0 && (
              <div className="archive-editor">
                <div>
                  <div className="eyebrow accent-eyebrow">ARCHIV</div>
                  <h3>Odložené nabídky</h3>
                </div>
                <div className="archive-list">
                  {archivedHomes.map((home) => (
                    <div className="archive-item" key={home.id}>
                      <div><strong>{home.title}</strong><small>{home.location}</small></div>
                      <button type="button" onClick={() => restoreArchivedHome(home.id)}><Undo2 size={14} aria-hidden="true" /> Obnovit</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {editMode && undoStack.length > 0 && (
          <div className="edit-toast" role="status">
            <span>{undoStack.at(-1)?.action === 'archive' ? 'Dům byl přesunut do archivu.' : 'Dům byl odstraněn.'}</span>
            <button type="button" onClick={undoLastEdit}><Undo2 size={15} aria-hidden="true" /> Vrátit zpět</button>
          </div>
        )}

        <div className="catalog-layout">
          <section className="listings-section" id="catalog-results" aria-label="Nabídky domů" tabIndex={-1}>
            <div className="section-bar">
              <div>
                <h2>{editMode ? 'Upravit nabídky' : 'Vybrané nabídky'}</h2>
              </div>
              <span className="section-note">{refreshingSources.includes('listing') ? <><RefreshCw size={13} className="is-spinning" aria-hidden="true" /> Aktualizace nabídek</> : `${homes.filter((home) => home.dataStatus === 'ready').length} / ${homes.length} načteno`}</span>
            </div>

            {filteredHomes.length ? (
              <div className="listing-grid">
                {filteredHomes.map((home, index) => (
                  <ListingCard
                    key={home.id}
                    home={home}
                    rank={index + 1}
                    score={scoreFor(home, weights, homes)}
                    editMode={editMode}
                    onToggleCover={toggleCoverImage}
                    onSetMain={setCoverMain}
                    onAddAiFiles={addAiImagesFromFiles}
                    onAddAiImageUrl={addAiImageUrl}
                    onRemoveAiImage={removeAiImage}
                    onRequestRemoval={(homeId, action) => setPendingRemoval({ homeId, action })}
                    fuelPrice={fuelPrices[fuelType]}
                    onRefreshListing={() => void onRefreshListing(home.id)}
                    isRefreshing={refreshingSources.includes('listing')}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                {hasActiveFilters ? <Search size={32} aria-hidden="true" /> : <House size={32} aria-hidden="true" />}
                <h3>{hasActiveFilters ? 'Žádný dům neodpovídá filtrům' : 'Zatím nemáte žádné domy'}</h3>
                {hasActiveFilters && (
                  <button className="catalog-primary" type="button" onClick={resetFilters}><X size={16} aria-hidden="true" /> Zrušit filtry</button>
                )}
                {!hasActiveFilters && <button className="catalog-primary" type="button" onClick={openAddHome}><Plus size={16} aria-hidden="true" /> Přidat první dům</button>}
              </div>
            )}
          </section>

          <aside className="insight-rail">
            <div className="rail-heading">
              <span className="eyebrow">PŘEHLED</span>
              <span className="rail-status">{refreshingSources.length ? 'Aktualizace dat' : 'Veřejné zdroje'}</span>
            </div>

            <section className="insight-block route-insight">
              <div className="insight-title-row">
                <div>
                  <span className="micro-label">AUTEM DO PRAHY</span>
                  <h3>{fastestRoute?.home.municipality ?? 'Trasa není dostupná'}</h3>
                </div>
                <MapPin size={20} aria-hidden="true" />
              </div>
              {fastestRoute ? (
                <>
                  <div className="route-line featured-route">
                    <span>Auto</span>
                    <strong>{fastestRoute.home.routes.prague.car}</strong>
                    <span>· do cíle</span>
                  </div>
                  <div className="route-bars" aria-label="Porovnání dojezdu do Prahy">
                    {routeCandidates.map(({ home, minutes }) => {
                      const width = longestRoute ? Math.max(18, (minutes / longestRoute.minutes) * 100) : 100
                      return (
                        <div key={home.id}>
                          <span>{home.municipality}</span>
                          <i style={{ width: `${width}%` }} />
                          <b>{home.routes.prague.car}</b>
                        </div>
                      )
                    })}
                  </div>
                  <a className="text-link" href="https://mapy.com/" target="_blank" rel="noreferrer">
                    Zdroj výpočtu trasy <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </>
              ) : (
                <p className="insight-empty">Bez dostupných tras</p>
              )}
            </section>

            <section className="insight-block fuel-insight">
              <div className="insight-title-row">
                <div>
                  <span className="micro-label">PROVOZNÍ NÁKLAD</span>
                  <h3>Palivo dnes</h3>
                </div>
                <Fuel size={20} aria-hidden="true" />
              </div>
              <div className="fuel-switcher" role="group" aria-label="Typ paliva">
                {(Object.keys(fuelDefaults) as FuelType[]).map((type) => (
                  <button
                    className={fuelType === type ? 'is-active' : ''}
                    key={type}
                    type="button"
                    onClick={() => setFuelType(type)}
                    aria-pressed={fuelType === type}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <div className="fuel-price">
                {fuelStatus === 'live' ? (
                  <><strong>{formatDecimal(fuelPrices[fuelType])}</strong><span>Kč / litr</span></>
                ) : (
                  <><strong>—</strong><span>{refreshingSources.includes('fuel') ? 'načítání' : 'nedostupné'}</span></>
                )}
              </div>
              <p className="fuel-note">
                {fuelStatus === 'live' ? 'Načteno z mBenzin.cz' : fuelMessage ?? 'Živá cena paliva zatím není dostupná.'}
              </p>
              <button className="panel-refresh-button" type="button" onClick={() => void onRefreshFuel()} disabled={refreshingSources.includes('fuel')}>
                <RefreshCw size={14} className={refreshingSources.includes('fuel') ? 'is-spinning' : ''} aria-hidden="true" /> {refreshingSources.includes('fuel') ? 'Načítám cenu' : 'Obnovit cenu paliva'}
              </button>
              <a className="text-link" href={fuelSourceUrl} target="_blank" rel="noreferrer">
                Zdroj cen paliva <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </section>

            <section className="insight-block checklist-insight">
              <div className="insight-title-row">
                <div>
                  <span className="micro-label">CO UŽ VÍME</span>
                  <h3>Dostupná data</h3>
                </div>
                <strong className="check-count">{String(completedChecklistItems).padStart(2, '0')} <small>/ {checklistItems.length}</small></strong>
              </div>
              <div className="check-list">
                {checklistItems.map((item) => (
                  <div className={`check-item ${item.done ? 'done' : 'pending'}`} key={item.label}>
                    <span>{item.done ? <CheckCheck size={16} aria-label="Dostupné" /> : <Circle size={16} aria-label="Nedostupné" />}</span>
                    <div><strong>{item.label}</strong><small>{item.detail}</small></div>
                  </div>
                ))}
              </div>
            </section>

          </aside>
        </div>
      </main>
      <dialog
        className="add-home-dialog"
        ref={addHomeDialog}
        onCancel={() => setShowAddHome(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            setShowAddHome(false)
          }
        }}
        aria-labelledby="add-home-title"
      >
        <div className="add-dialog-heading">
          <div><span className="eyebrow">NOVÁ NABÍDKA</span><h2 id="add-home-title">Přidat dům</h2></div>
          <button className="icon-button" type="button" onClick={() => setShowAddHome(false)} aria-label="Zavřít dialog" title="Zavřít dialog"><X size={20} aria-hidden="true" /></button>
        </div>
        <form className="add-dialog-form" onSubmit={addHomeFromLink}>
          <label htmlFor="listing-url"><Link2 size={16} aria-hidden="true" /> Odkaz na nabídku z Eurobydlení</label>
          <input id="listing-url" type="url" autoFocus value={listingUrlInput} onChange={(event) => { setListingUrlInput(event.target.value); setAddHomeMessage(null) }} placeholder="https://www.eurobydleni.cz/…" required aria-invalid={addHomeMessage?.kind === 'error'} aria-describedby={addHomeMessage?.kind === 'error' ? 'add-home-error' : undefined} />
          {addHomeMessage?.kind === 'error' && <p className="dialog-error" id="add-home-error" role="alert">{addHomeMessage.text}</p>}
          <div className="add-dialog-actions">
            <button className="catalog-secondary" type="button" onClick={() => setShowAddHome(false)}>Zrušit</button>
            <button className="catalog-primary" type="submit">Přidat dům <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        </form>
      </dialog>
      {pendingRemoval && pendingHome && (
        <ConfirmDialog
          home={pendingHome}
          action={pendingRemoval.action}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={confirmHomeRemoval}
        />
      )}
      <footer className="app-footer">
        <span>DOMY. / pracovní shortlist</span>
        <span>Data jsou orientační · před rozhodnutím ověřit u zdroje</span>
      </footer>
    </div>
  )
}
