export const SITE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'https://aboks.no'
export const SITE_NAME = 'aBoks'
export const LOGO_URL = `${SITE_URL}/logo.png`

export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}
