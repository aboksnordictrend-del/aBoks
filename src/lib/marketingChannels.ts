// Shared marketing-channel vocabulary. Used by the marketing-expenses collection (select
// options) and the analytics layer (labels for KPI/CSV/channel breakdown), so the two can
// never drift apart.

export const MARKETING_CHANNELS = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'snapchat', label: 'Snapchat Ads' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'annet', label: 'Annet' },
] as const

export type MarketingChannel = (typeof MARKETING_CHANNELS)[number]['value']

/** Human label for a stored channel value (falls back to the raw value). */
export function channelLabel(value: string): string {
  return MARKETING_CHANNELS.find((c) => c.value === value)?.label ?? value
}
