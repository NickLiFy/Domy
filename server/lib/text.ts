export const cleanText = (value: string | undefined) =>
  (value ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()

export const cleanDescription = (value: string | undefined) =>
  (value ?? '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(?:p|li|div|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

/** Accent- and case-insensitive key used to match Czech labels scraped from the listing. */
export const normalizedLabel = (value: string) =>
  cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs-CZ')
    .replace(/:$/, '')

export const parseNumber = (value: string | undefined) => {
  const match = cleanText(value).match(/\d[\d\s.]*(?:,\d+)?/)
  if (!match) return 0

  const normalized = match[0]
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : 0
}
