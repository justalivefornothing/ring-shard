import type { OwnerMap } from './remap'

export interface LoadStats {
  counts: Map<string, number>
  mean: number
  /** Population standard deviation of per-node key counts. */
  stddev: number
  /** stddev / mean, or 0 when there is nothing to divide. */
  cv: number
}

export function loadStats(owners: OwnerMap, nodes: readonly string[], keys: readonly string[]): LoadStats {
  const counts = new Map<string, number>(nodes.map((n) => [n, 0]))
  for (const k of keys) {
    const o = owners[k]
    if (o !== undefined && counts.has(o)) counts.set(o, counts.get(o)! + 1)
  }
  const values = [...counts.values()]
  const mean = values.length ? keys.length / values.length : 0
  const variance = values.length ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length : 0
  const stddev = Math.sqrt(variance)
  return { counts, mean, stddev, cv: mean ? stddev / mean : 0 }
}

/** Deterministic sample keys: key-0000, key-0001, ... */
export function sampleKeys(n: number, prefix = 'key'): string[] {
  const width = Math.max(4, String(Math.max(0, n - 1)).length)
  return Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(width, '0')}`)
}
