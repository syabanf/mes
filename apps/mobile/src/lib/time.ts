import { wib } from '@mes/fixtures'

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name

/** "Good morning" style greeting for the home header, on the app clock in WIB. */
export function greeting(now: number) {
  const hour = wib(now).hours
  if (hour < 11) return 'Good morning'
  if (hour < 15) return 'Good afternoon'
  if (hour < 19) return 'Good evening'
  return 'Good night'
}
