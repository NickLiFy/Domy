# DOMY.

React + TypeScript + Vite shortlist nemovitostí. Aplikace nepoužívá seedované domy ani dummy údaje.

## Struktura

```
server/            Node API – bez závislosti na Vite, mountovatelné i na holý http server
  index.ts         connect middleware pro /api/*
  router.ts        tabulka rout + handlery
  lib/             http obálka, cache, síť, geo, text
  sources/         listing, geocode, crime, access, routes, fuel
src/
  api/             klient nad /api/* (envelope, dedupe requestů)
  components/      CatalogPage, DetailPage a jejich části
  config/          cíle tras, váhy skóre, konstanty
  hooks/           useHomes, useFuelPrices, useAutoRoutes, useRefreshTracker
  lib/             formátování, skóre, model domu, localStorage
  router/          history router (`/` a `/dum/:id`)
  types/           doménové a API typy
```

## Živá data

Po vložení přímého odkazu na detail z Eurobydlení se přes lokální API načtou:

- cena, parametry, celý popis, strukturované údaje a fotografie z nabídky,
- souřadnice přes OpenStreetMap Nominatim,
- silniční trasy a kilometry přes OSRM,
- nejbližší zastávky, školky/školy a obchody přes OpenStreetMap Overpass (fallback: OSM map API),
- případy kriminality z veřejného API Policie ČR,
- aktuální ceny paliva přes mBenzin.cz.

Snapshoty domů a ceny paliva se ukládají do `localStorage`; při dalším otevření se nejdřív zobrazí poslední uložená data. Dům se z Eurobydlení znovu načte až po stisknutí `Obnovit nabídku`, ostatní zdroje mají vlastní refresh tlačítka a obnovují se na pozadí.

Měsíční dataset Policie ČR se ukládá do `.cache/` (mimo git), takže se stahuje jednou za měsíc místo při každém startu serveru.

MHD a vlak se zobrazí jako `—`, pokud není k dispozici ověřený veřejný routing zdroj. Aplikace je nedoplňuje odhadem.

## API

Každý endpoint odpovídá stejnou obálkou, i když zdroj selže:

```json
{ "data": { }, "warnings": ["…"], "error": { "code": "…", "message": "…" } }
```

`data` je `null` jen tehdy, když opravdu není co zobrazit; `warnings` a `error` se v UI vypíšou pod obsahem. HTTP 4xx se vrací pouze u vadného požadavku, výpadek cizího zdroje je vždy 200 s vyplněným `error`.

| Endpoint | Parametry |
| --- | --- |
| `GET /api/listing` | `url` – detail z www.eurobydleni.cz |
| `GET /api/safety` | `lat`, `lon`, volitelně `radiusKm` (0,5–20) |
| `GET /api/access` | `lat`, `lon`, volitelně `radiusM` (200–5000) |
| `GET /api/routes` | `lat`, `lon`, opakované `to=klíč:adresa` (max 8) |
| `GET /api/fuel` | – |

## Spuštění

```bash
npm install
npm run dev
```

## Kontroly

```bash
npm run lint
npm run build
```
