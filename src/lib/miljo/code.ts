// Public organisation codes for /miljo/[publicCode]. Pure except for the injected random source.
//
// The code is what the printed QR sticker encodes, so it is:
//   • unguessable — 10 characters from a 31-letter alphabet ≈ 49 bits, drawn with rejection
//     sampling from a CSPRNG, so nobody can find another organisation's page by trying names;
//   • permanent — generated once on create and never derived from the name, so renaming an
//     organisation never breaks a sticker. Only an explicit admin rotation replaces it;
//   • easy to read aloud — lowercase, without the look-alikes 0/o, 1/l/i.

import { randomBytes } from 'node:crypto'

export const PUBLIC_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const PUBLIC_CODE_LENGTH = 10

const CODE_PATTERN = new RegExp(`^[${PUBLIC_CODE_ALPHABET}]{${PUBLIC_CODE_LENGTH}}$`)

export type RandomSource = (size: number) => Uint8Array

/** Uniform over the alphabet: bytes ≥ the largest multiple of its length are discarded. */
export function generatePublicCode(random: RandomSource = randomBytes): string {
  const n = PUBLIC_CODE_ALPHABET.length
  const limit = 256 - (256 % n)
  let out = ''
  while (out.length < PUBLIC_CODE_LENGTH) {
    for (const byte of random(PUBLIC_CODE_LENGTH * 2)) {
      if (byte >= limit) continue
      out += PUBLIC_CODE_ALPHABET[byte % n]
      if (out.length === PUBLIC_CODE_LENGTH) break
    }
  }
  return out
}

export function isValidPublicCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_PATTERN.test(value)
}
