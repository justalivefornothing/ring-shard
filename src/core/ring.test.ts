import { describe, expect, it } from 'vitest'
import { fnv1a, hashToDegrees } from './fnv1a'
import { Ring } from './ring'
import { diffOwners, moduloRemapFraction, ownersOf } from './remap'
import { loadStats, sampleKeys } from './stats'

const keys10k = sampleKeys(10_000)

/** Brute-force a key whose hash lands strictly above `threshold` (used to force wraparound). */
function findKeyWithHashAbove(threshold: number): string {
  for (let i = 0; ; i++) {
    const k = `probe-${i}`
    if (fnv1a(k) > threshold) return k
  }
}

describe('fnv1a', () => {
  it('matches the reference 32-bit vectors', () => {
    expect(fnv1a('hello')).toBe(0x4f9f2cab)
    expect(fnv1a('')).toBe(0x811c9dc5)
    expect(fnv1a('a')).toBe(0xe40c292c)
    expect(fnv1a('foobar')).toBe(0xbf9cf968)
  })

  it('hashes multi-byte characters over their UTF-8 bytes', () => {
    // "é" is c3 a9 in UTF-8; hash it byte by byte by hand.
    let h = 0x811c9dc5
    for (const b of [0xc3, 0xa9]) h = Math.imul(h ^ b, 0x01000193)
    expect(fnv1a('é')).toBe(h >>> 0)
    expect(fnv1a('🔑')).not.toBe(fnv1a('?'))
  })

  it('maps the hash space onto 360 degrees', () => {
    expect(hashToDegrees(0)).toBe(0)
    expect(hashToDegrees(2 ** 31)).toBe(180)
    expect(hashToDegrees(2 ** 32 - 1)).toBeLessThan(360)
  })
})

describe('Ring', () => {
  it('removing a node only moves the keys that node owned', () => {
    const ring = new Ring(['a', 'b', 'c', 'd'], 100)
    const before = ownersOf(ring, keys10k)
    ring.remove('d')
    const after = ownersOf(ring, keys10k)
    for (const k of keys10k) if (before[k] !== 'd') expect(after[k]).toBe(before[k])
    for (const k of keys10k) expect(after[k]).not.toBe('d')
  })

  it('moves roughly a quarter of the keys when one of four nodes leaves', () => {
    const ring = new Ring(['a', 'b', 'c', 'd'], 100)
    const before = ownersOf(ring, keys10k)
    ring.remove('d')
    const after = ownersOf(ring, keys10k)
    const moved = keys10k.filter((k) => before[k] !== after[k]).length / 10_000
    expect(moved).toBeGreaterThan(0.18)
    expect(moved).toBeLessThan(0.32)
    expect(diffOwners(before, after, keys10k).fraction).toBe(moved)
  })

  it('wraps a key hashed past the last vnode around to index 0', () => {
    const ring = new Ring(['a'], 1)
    const keyBeyondMax = findKeyWithHashAbove(ring.maxVnodeHash)
    expect(ring.lookup(keyBeyondMax)).toBe(ring.ownerAt(0))
    expect(ring.lookupIndex(keyBeyondMax)).toBe(0)
  })

  it('binary search agrees with a linear scan', () => {
    const ring = new Ring(['a', 'b', 'c'], 37)
    const entries = ring.entries()
    for (const k of keys10k.slice(0, 500)) {
      const h = fnv1a(k)
      const linear = entries.find((e) => e.hash >= h) ?? entries[0]!
      expect(ring.lookup(k)).toBe(linear.node)
    }
  })

  it('adding a node back restores the original ownership', () => {
    const ring = new Ring(['a', 'b', 'c', 'd'], 50)
    const before = ownersOf(ring, keys10k)
    ring.remove('b')
    ring.add('b')
    expect(ownersOf(ring, keys10k)).toEqual(before)
    expect(ring.size).toBe(200)
  })

  it('lists N distinct successors clockwise, capped at the node count', () => {
    const ring = new Ring(['a', 'b', 'c', 'd'], 20)
    const reps = ring.successors('user:42', 3)
    expect(reps).toHaveLength(3)
    expect(new Set(reps).size).toBe(3)
    expect(reps[0]).toBe(ring.lookup('user:42'))
    expect(ring.successors('user:42', 9)).toHaveLength(4)
    expect(new Ring([], 5).successors('x', 2)).toEqual([])
  })

  it('refuses lookups on an empty ring and rejects bad vnode counts', () => {
    const empty = new Ring([], 10)
    expect(empty.size).toBe(0)
    expect(() => empty.lookup('k')).toThrow(RangeError)
    expect(ownersOf(empty, keys10k)).toEqual({})
    expect(() => new Ring(['a'], 0)).toThrow(RangeError)
  })
})

describe('modulo hashing', () => {
  it('moves most keys when shrinking from 4 to 3 slots', () => {
    expect(moduloRemapFraction(keys10k, 4, 3)).toBeGreaterThan(0.6)
  })

  it('works on named topologies and is zero for no change', () => {
    expect(moduloRemapFraction(keys10k, ['a', 'b'], ['a', 'b'])).toBe(0)
    expect(moduloRemapFraction(keys10k, ['a', 'b', 'c'], ['a', 'b'])).toBeGreaterThan(0.5)
  })
})

describe('loadStats', () => {
  it('counts keys per node and reports the standard deviation', () => {
    const ring = new Ring(['a', 'b', 'c', 'd'], 100)
    const stats = loadStats(ownersOf(ring, keys10k), ring.nodes, keys10k)
    expect([...stats.counts.values()].reduce((s, v) => s + v, 0)).toBe(10_000)
    expect(stats.mean).toBe(2500)
    expect(stats.stddev).toBeGreaterThan(0)
    expect(stats.cv).toBeLessThan(0.25)
  })

  it('more vnodes flatten the distribution', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e']
    const few = loadStats(ownersOf(new Ring(nodes, 1), keys10k), nodes, keys10k)
    const many = loadStats(ownersOf(new Ring(nodes, 200), keys10k), nodes, keys10k)
    expect(many.stddev).toBeLessThan(few.stddev)
  })
})
