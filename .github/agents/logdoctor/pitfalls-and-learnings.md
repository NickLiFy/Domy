# LogDoctor — Pitfalls & Learnings

Private learning log for the LogDoctor agent, self-maintained (no external hand-off).
Read this file before starting a task. After finishing, append one entry per durable
lesson worth remembering next time. Newest on top.

## Format
- **[YYYY-MM-DD] <task/context> → <short lesson>**
  - ctx: what went wrong
  - rule: durable rule for next time
  - status: ✗ | ⚠

<!-- entries below (newest first) -->
- **[2026-09-18] Local project transfer into a GitHub clone -> copy without mirroring `.git` or deleting destination files**
  - ctx: The source project had no Git metadata, while the destination already contained its own GitHub-connected `.git` directory and `LICENSE`.
  - rule: Use a no-delete recursive copy that excludes `.git`, then compare source and destination file paths, sizes, and hashes and recheck the destination remote.
  - status: ⚠

- **[2026-09-18] Nearby access accuracy -> keep all OSM candidates but never invent walking times**
  - ctx: Nearby places were limited before routing, aerial-distance estimates were shown as walking times, and coordinate-only map links opened a locality rather than the specific stop or shop.
  - rule: Preserve every active OSM candidate in the requested radius, enrich it with batched walking routes, leave walking time unknown when routing fails, and link to the exact OSM element when its type and ID are available.
  - status: ⚠

- **[2026-09-18] Nearby access place links -> preserve OSM coordinates through the API**
  - ctx: The access source already had exact coordinates for nearby OSM elements, but the `NearbyPlace` payload dropped them before the frontend rendered names, so the UI could not link to a specific shop, school, or stop.
  - rule: Keep nearby-place coordinates optional in both server and client contracts for compatibility with frozen snapshots, and build exact map links when present with a name-search fallback for older records.
  - status: ⚠

- **[2026-09-18] Route targets derived from listing context -> migrate frozen snapshots**
  - ctx: The configured center address was empty, so it was filtered out before Mapy routing; saved homes also kept an older frozen snapshot and never saw the new work-target defaults.
  - rule: Resolve an empty center target from the loaded municipality, add locality context for ambiguous work addresses, and version frozen snapshots so targeted migrations run once without reopening regular paid recalculation.
  - status: ⚠

- **[2026-09-18] Mapy.com routing and frozen home snapshots -> separate car and walking matrices**
  - ctx: Mapy.com REST routing supports car, foot and bicycle modes, but not public transit; one matrix request can cover many destinations only for one mode. The frontend previously recalculated routes from an address key and the server filled transit with a placeholder.
  - rule: Keep Mapy API credentials server-side, batch destinations in one matrix per mode, persist the returned snapshot on the home, and never turn an address edit into an automatic paid recomputation. Do not label Mapy car or walking output as MHD; require a licensed transit provider such as IDOS for that.
  - status: ⚠

- **[2026-09-17] Audit + refaktor DOMY → business logika v `vite.config.ts` maskovala chyby API**
  - ctx: ~870 řádků scraperů, cache a routingu bylo uvnitř build configu jako `if`/`else` řetěz. Každý endpoint měl jiný timeout i jiný chybový kód, `/api/safety` stahoval celý celostátní GeoJSON do RAM (první request vždy 502), `/api/routes` bral JSON blob z query stringu bez limitu a parser paliva mapoval hodnoty podle pořadí, ne podle popisku.
  - rule: Serverovou část drž mimo `vite.config.ts` (`server/` + connect middleware), routy jako tabulku `path → metoda → handler`, jednu odpověďovou obálku `{ data, warnings, error }` pro všechny endpointy a velké veřejné datasety cachuj na disk s TTL, ne do neomezené `Map`. Hodnoty ze scrapovaného textu páruj přes zachycený popisek, nikdy přes index shody.
  - status: ⚠

- **[2026-09-17] Windows + `erasableSyntaxOnly` → parameter properties a `ReturnType<typeof cheerioInstance>` neprojdou**
  - ctx: `tsconfig.node.json` má `erasableSyntaxOnly: true`, takže `constructor(private readonly ttlMs: number)` je chyba; u cheerio navíc `ReturnType<typeof document>` neodpovídá tomu, co vrací `document(element)`.
  - rule: V tomto repu piš třídy s explicitními poli a přiřazením v konstruktoru. Pomocné funkce nad cheerio netypuj přes `ReturnType<typeof ...>` – raději kód zopakuj uvnitř `.each()` callbacku, kde je typ elementu odvozený.
  - status: ⚠

- **[2026-09-17] OSM nearby data and route geocoding → keep independent fallbacks and invalidate stale route snapshots**
  - ctx: Overpass timed out in the local network and a labeled destination such as `SAPA, Libušská...` could not be geocoded as one exact query, leaving nearby data and routes empty.
  - rule: Bound the primary nearby source, use a real OSM map-data fallback, try progressively simpler route address variants, and version route cache keys when the route contract changes.
  - status: ⚠

- **[2026-09-17] Windows PowerShell search → `rg` may be unavailable; use `Select-String`**
  - ctx: `rg` returned `The term 'rg' is not recognized as the name of a cmdlet...` on a
    Windows environment during a diagnosis task.
  - rule: Do not retry `rg` blindly on Windows. For known files use
    `$files = @('path\one','path\two'); Select-String -Path $files -Pattern 'text'`.
    For a targeted recursive search use
    `Get-ChildItem -Path . -Recurse -File | Where-Object { $_.FullName -notmatch '\\(node_modules|\.git)\\' } | Select-String -SimpleMatch -Pattern 'text'`.
    Add `-ErrorAction SilentlyContinue` when optional paths may be absent.
  - status: ⚠
