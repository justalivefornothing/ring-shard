/**
 * FNV-1a, 32-bit, over the UTF-8 encoding of a string.
 *
 *   hash = offset_basis
 *   for each byte: hash ^= byte; hash *= FNV_prime (mod 2^32)
 *
 * Math.imul keeps the multiply in 32-bit integer land; the final `>>> 0`
 * re-interprets the signed result as an unsigned 32-bit integer.
 */
const OFFSET_BASIS = 0x811c9dc5
const PRIME = 0x01000193

export const HASH_SPACE = 2 ** 32

export function fnv1a(input: string): number {
  let h = OFFSET_BASIS
  for (let i = 0; i < input.length; i++) {
    let cp = input.codePointAt(i)!
    if (cp > 0xffff) i++ // consumed a surrogate pair

    if (cp < 0x80) {
      h = Math.imul(h ^ cp, PRIME)
    } else if (cp < 0x800) {
      h = Math.imul(h ^ (0xc0 | (cp >> 6)), PRIME)
      h = Math.imul(h ^ (0x80 | (cp & 0x3f)), PRIME)
    } else if (cp < 0x10000) {
      h = Math.imul(h ^ (0xe0 | (cp >> 12)), PRIME)
      h = Math.imul(h ^ (0x80 | ((cp >> 6) & 0x3f)), PRIME)
      h = Math.imul(h ^ (0x80 | (cp & 0x3f)), PRIME)
    } else {
      h = Math.imul(h ^ (0xf0 | (cp >> 18)), PRIME)
      h = Math.imul(h ^ (0x80 | ((cp >> 12) & 0x3f)), PRIME)
      h = Math.imul(h ^ (0x80 | ((cp >> 6) & 0x3f)), PRIME)
      h = Math.imul(h ^ (0x80 | (cp & 0x3f)), PRIME)
    }
  }
  return h >>> 0
}

/** Angle in degrees (0..360) of a 32-bit hash on the ring, 0 at twelve o'clock. */
export function hashToDegrees(h: number): number {
  return (h / HASH_SPACE) * 360
}

export function hex32(h: number): string {
  return h.toString(16).padStart(8, '0')
}
