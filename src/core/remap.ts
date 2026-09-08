import { fnv1a } from './fnv1a'
import type { Ring } from './ring'

/** key -> owning node */
export type OwnerMap = Record<string, string>

export interface RemapDiff {
  moved: string[]
  fraction: number
}

export function ownersOf(ring: Ring, keys: readonly string[]): OwnerMap {
  const out: OwnerMap = {}
  if (ring.size === 0) return out
  for (const k of keys) out[k] = ring.lookup(k)
  return out
}

/** Keys whose owner differs between two maps (a key missing from either side counts as moved). */
export function diffOwners(before: OwnerMap, after: OwnerMap, keys: readonly string[]): RemapDiff {
  const moved: string[] = []
  for (const k of keys) if (before[k] !== after[k]) moved.push(k)
  return { moved, fraction: keys.length === 0 ? 0 : moved.length / keys.length }
}

type Topology = number | readonly string[]

function asNodes(t: Topology): readonly string[] {
  return typeof t === 'number' ? Array.from({ length: t }, (_, i) => String(i)) : t
}

/** The naive alternative: key goes to nodes[hash % nodes.length]. */
export function moduloOwners(keys: readonly string[], topology: Topology): OwnerMap {
  const nodes = asNodes(topology)
  const out: OwnerMap = {}
  if (nodes.length === 0) return out
  for (const k of keys) out[k] = nodes[fnv1a(k) % nodes.length]!
  return out
}

/** Fraction of keys that change owner under modulo hashing when the topology changes. */
export function moduloRemapFraction(keys: readonly string[], from: Topology, to: Topology): number {
  return diffOwners(moduloOwners(keys, from), moduloOwners(keys, to), keys).fraction
}
