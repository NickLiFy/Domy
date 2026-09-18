import { useEffect, useState } from 'react'
import './App.css'
import './catalog.css'
import './detail.css'
import { CatalogPage } from './components/CatalogPage'
import { DataRefreshNotice } from './components/DataRefreshNotice'
import { DetailPage } from './components/DetailPage'
import { defaultWeights } from './config/app'
import { useAutoRoutes } from './hooks/useAutoRoutes'
import { useFuelPrices } from './hooks/useFuelPrices'
import { useHomes } from './hooks/useHomes'
import { loadAddressSettings, saveAddressSettings } from './lib/storage'
import { scoreFor } from './lib/score'
import { Link, navigate, useAppRoute } from './router/Router'
import { catalogPath, detailPath, isLegacyDetailUrl } from './router/paths'
import type { AddressSettings, FuelType } from './types/home'

function NotFoundPage({ homeId }: { homeId: string }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to={catalogPath()}>DOMY<span>.</span></Link>
        <Link className="back-link" to={catalogPath()}><span aria-hidden="true">←</span> Katalog</Link>
      </header>
      <main className="app-main">
        <div className="empty-state">
          <span>⌕</span>
          <h3>Tento dům v shortlistu není</h3>
          <p>Nabídka <code>{homeId}</code> byla odstraněna nebo archivována. Vraťte se do katalogu.</p>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  const route = useAppRoute()
  const [addressSettings, setAddressSettings] = useState<AddressSettings>(loadAddressSettings)
  const [fuelType, setFuelType] = useState<FuelType>('Natural 95')
  const [weights, setWeights] = useState(defaultWeights)

  const {
    homes,
    setHomes,
    archivedHomes,
    setArchivedHomes,
    activeSources,
    refreshListing,
    refreshSafety,
    refreshAccess,
    refreshRoutes,
  } = useHomes(addressSettings)
  const fuel = useFuelPrices()
  const autoRoutes = useAutoRoutes(homes, addressSettings, setHomes)

  useEffect(() => {
    saveAddressSettings(addressSettings)
  }, [addressSettings])

  // Rewrite pre-router `?home=<id>` links to the canonical path without adding a history entry.
  useEffect(() => {
    if (route.name === 'detail' && isLegacyDetailUrl(window.location.search)) {
      navigate(detailPath(route.homeId), { replace: true })
    }
  }, [route])

  const refreshingSources = [
    ...activeSources,
    ...(fuel.isRefreshing ? (['fuel'] as const) : []),
    ...(autoRoutes.isRefreshing ? (['routes'] as const) : []),
  ]

  const detailHome = route.name === 'detail' ? homes.find((home) => home.id === route.homeId) : undefined

  return (
    <>
      {route.name === 'detail' ? (
        detailHome ? (
          <DetailPage
            home={detailHome}
            fuelPrice={fuel.prices[fuelType]}
            fuelType={fuelType}
            fuelStatus={fuel.status}
            addressSettings={addressSettings}
            score={scoreFor(detailHome, weights, homes)}
            onRefreshListing={refreshListing}
            onRefreshSafety={refreshSafety}
            onRefreshAccess={refreshAccess}
            onRefreshRoutes={refreshRoutes}
            onRefreshFuel={fuel.refresh}
            refreshingSources={refreshingSources}
          />
        ) : (
          <NotFoundPage homeId={route.homeId} />
        )
      ) : (
        <CatalogPage
          editMode={route.editMode}
          weights={weights}
          setWeights={setWeights}
          homes={homes}
          setHomes={setHomes}
          archivedHomes={archivedHomes}
          setArchivedHomes={setArchivedHomes}
          addressSettings={addressSettings}
          setAddressSettings={setAddressSettings}
          fuelType={fuelType}
          setFuelType={setFuelType}
          fuelPrices={fuel.prices}
          fuelStatus={fuel.status}
          fuelMessage={fuel.message}
          onRefreshFuel={fuel.refresh}
          refreshingSources={refreshingSources}
          onRefreshListing={refreshListing}
          onRefreshSafety={refreshSafety}
          onRefreshAccess={refreshAccess}
        />
      )}
      <DataRefreshNotice sources={refreshingSources} />
    </>
  )
}
