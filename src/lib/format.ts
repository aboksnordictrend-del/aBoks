export function formatPrice(amount: number): string {
  return 'kr ' + Number(amount).toLocaleString('nb-NO')
}

export function generateOrderNumber(seed?: number): string {
  const base = seed ?? Math.floor(Math.random() * 9999)
  return 'AB-' + String(28400 + base).padStart(6, '0')
}
