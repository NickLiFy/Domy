export const formatPrice = (price: number) => `${new Intl.NumberFormat('cs-CZ').format(price)} Kč`

export const formatMillions = (price: number) => `${(price / 1_000_000).toFixed(2).replace('.', ',')} mil.`

export const formatDecimal = (value: number) => value.toFixed(2).replace('.', ',')

export const formatCrimeMonth = (month: string) =>
  /^\d{6}$/.test(month) ? `${month.slice(4, 6)}/${month.slice(0, 4)}` : month

export const formatCrimeDate = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

/** Splits a scraped description into readable paragraphs, falling back to sentence pairs. */
export const splitDescription = (value: string) => {
  const normalized = value.replace(/\r/g, '').trim()
  if (!normalized) return ['Popis nabídky není dostupný.']

  const blocks = normalized
    .split(/\n{2,}|\n(?=\s*(?:[-•*]|\d+[.)])\s*)/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
  if (blocks.length > 1) return blocks

  const sentences =
    normalized.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [normalized]
  if (sentences.length <= 2) return [normalized]

  const grouped: string[] = []
  for (let index = 0; index < sentences.length; index += 2) {
    grouped.push(sentences.slice(index, index + 2).join(' '))
  }
  return grouped
}

export const durationInMinutes = (value: string) => {
  const match = value.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)(?:\s*min)?)?$/i)
  if (!match || (!match[1] && !match[2])) return Number.POSITIVE_INFINITY
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0)
}
