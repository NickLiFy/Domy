import { load } from 'cheerio'
import type { Listing, ListingFact } from '../types.js'
import { fetchText } from '../lib/net.js'
import { cleanDescription, cleanText, normalizedLabel, parseNumber } from '../lib/text.js'

const allowedHosts = new Set(['eurobydleni.cz', 'www.eurobydleni.cz'])

/** Guards against SSRF: only direct Eurobydlení detail pages may be fetched. */
export const parseListingUrl = (value: string): URL | null => {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (!allowedHosts.has(parsed.hostname.toLocaleLowerCase('cs-CZ'))) return null
  if (!parsed.pathname.includes('/detail/')) return null
  return parsed
}

const collectFacts = ($: ReturnType<typeof load>): ListingFact[] => {
  const facts: ListingFact[] = []
  const seen = new Set<string>()

  $('dt').each((_, element) => {
    const label = cleanText($(element).text())
    const value = cleanText($(element).next('dd').text())
    if (!label || !value) return
    const key = `${normalizedLabel(label)}:${value}`
    if (seen.has(key)) return
    seen.add(key)
    facts.push({ label: label.replace(/:$/, ''), value })
  })

  return facts
}

const collectImages = ($: ReturnType<typeof load>, listingUrl: string, listingId: string) => {
  const images = new Set<string>()

  $('img, source, a').each((_, element) => {
    const node = $(element)
    for (const candidate of [node.attr('src'), node.attr('data-src'), node.attr('data-original'), node.attr('href')]) {
      if (!candidate?.includes('/rozhrani/uploads/')) continue
      try {
        const imageUrl = new URL(candidate, listingUrl).toString()
        const isPhoto = /\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(imageUrl)
        const belongsToListing = !listingId || imageUrl.includes(`/${listingId}_`)
        if (isPhoto && belongsToListing) images.add(imageUrl)
      } catch {
        continue
      }
    }
  })

  return [...images]
}

export const parseListingHtml = (html: string, listingUrl: string): Listing => {
  const $ = load(html)
  const listingId = listingUrl.match(/\/detail\/(\d+)/)?.[1] ?? ''
  const facts = collectFacts($)

  const factValue = (...labels: string[]) =>
    facts.find((fact) => labels.some((label) => normalizedLabel(fact.label).includes(label)))?.value ?? ''

  const descriptionHeading = $('h2, h3, h4')
    .filter((_, element) => normalizedLabel($(element).text()) === 'popis')
    .first()
  const descriptionBlock = descriptionHeading
    .nextAll('div')
    .filter((_, element) => $(element).hasClass('box-desc'))
    .first()

  const title = cleanText(
    $('h1[itemprop="name"]').first().text() ||
      $('h1').first().text() ||
      $('meta[property="og:title"]').attr('content'),
  )
  const description = cleanDescription(
    descriptionBlock.html() || $('meta[property="og:description"]').attr('content'),
  )
  const street = cleanText(
    $('[itemprop="streetAddress"]').first().text() || $('[itemprop="streetAddress"]').attr('content'),
  )
  const municipality = cleanText(
    $('[itemprop="addressLocality"]').first().text() ||
      $('[itemprop="addressLocality"]').attr('content') ||
      factValue('adresa').split(',')[1],
  )
  const region = cleanText(
    $('[itemprop="addressRegion"]').first().text() || $('[itemprop="addressRegion"]').attr('content'),
  )
  const addressParts = [street, municipality, region].filter(Boolean)
  const status =
    facts
      .filter((fact) => normalizedLabel(fact.label) === 'stav')
      .map((fact) => fact.value)
      .find((value) => /rekonstruk|novostav|vystavb|dobr|spatn/i.test(value)) ?? factValue('stav')

  return {
    id: listingId,
    title: title || 'Nemovitost z nabídky',
    location: addressParts.join(' · ') || municipality || 'Lokalita z nabídky',
    municipality: municipality || '—',
    price: parseNumber(
      $('meta[itemprop="price"]').first().attr('content') || $('strong[class*="in-price"]').first().text(),
    ),
    area: parseNumber(factValue('plocha uzitna', 'obytn')),
    plot: parseNumber(factValue('plocha pozemku', 'pozemek')),
    rooms: description.match(/dispozici\s+([0-9]+(?:\+[0-9]+)?)/i)?.[1] || factValue('pocet pokoju') || '—',
    year: Number(description.match(/(?:roku|z roku)\s+(\d{4})/i)?.[1] ?? 0),
    status: status || 'Stav z nabídky',
    images: collectImages($, listingUrl, listingId),
    description: description || 'Popis nabídky nebyl nalezen.',
    facts,
    address: addressParts.join(', ') || municipality || title,
  }
}

export const fetchListing = async (listingUrl: URL): Promise<Listing> => {
  const html = await fetchText(listingUrl, 'text/html,application/xhtml+xml', 15000)
  return parseListingHtml(html, listingUrl.toString())
}
