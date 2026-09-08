import { fnv1a } from './fnv1a'

export interface Vnode {
  hash: number
  node: string
  /** Position in the sorted hash array. */
  index: number
}

/**
 * Label hashed for virtual node `v` of `node`.
 *
 * FNV-1a's high bits (which decide ring order) track the *last* input byte
 * almost linearly, so `node#0`..`node#99` land in tight clusters and one node
 * can end up owning 40% of the ring. Putting the counter first pushes its
 * bytes through the most multiply rounds, and the constant suffix adds mixing
 * after the last varying byte. Measured over several node sets this brings
 * the per-node load CV from ~0.43 down to ~0.08, which is what a uniformly
 * random placement would give.
 */
export function vnodeLabel(node: string, v: number): string {
  return `${v}/${node}#ring`
}

/**
 * A consistent-hashing ring.
 *
 * Every node contributes `vnodes` virtual nodes (see `vnodeLabel`). The vnode
 * hashes live in one sorted Uint32Array with a parallel array of owner
 * indices; a lookup is a binary search for the first vnode hash that is
 * >= the key hash, wrapping to index 0 when the key hashes past the last vnode.
 */
export class Ring {
  readonly vnodes: number
  private readonly nodeList: string[] = []
  private hashes = new Uint32Array(0)
  private owners = new Uint16Array(0)

  constructor(nodes: Iterable<string> = [], vnodes = 100) {
    if (!Number.isInteger(vnodes) || vnodes < 1) throw new RangeError('vnodes must be a positive integer')
    this.vnodes = vnodes
    for (const n of nodes) if (!this.nodeList.includes(n)) this.nodeList.push(n)
    this.rebuild()
  }

  get nodes(): readonly string[] {
    return this.nodeList
  }

  /** Total number of virtual nodes on the ring. */
  get size(): number {
    return this.hashes.length
  }

  get maxVnodeHash(): number {
    if (this.size === 0) throw new RangeError('ring is empty')
    return this.hashes[this.size - 1]!
  }

  add(node: string): void {
    if (this.nodeList.includes(node)) return
    this.nodeList.push(node)
    this.rebuild()
  }

  remove(node: string): void {
    const i = this.nodeList.indexOf(node)
    if (i === -1) return
    this.nodeList.splice(i, 1)
    this.rebuild()
  }

  /** Node that owns the vnode at sorted position `index`. */
  ownerAt(index: number): string {
    const o = this.owners[index]
    if (o === undefined) throw new RangeError(`no vnode at index ${index}`)
    return this.nodeList[o]!
  }

  /** Sorted index of the vnode that owns `key`: first hash >= key hash, wrapping to 0. */
  lookupIndex(key: string): number {
    if (this.size === 0) throw new RangeError('ring is empty')
    const i = this.lowerBound(fnv1a(key))
    return i === this.size ? 0 : i
  }

  lookup(key: string): string {
    return this.ownerAt(this.lookupIndex(key))
  }

  /**
   * The first `n` distinct nodes met walking clockwise from the key's position.
   * Returns fewer than `n` when the ring has fewer nodes.
   */
  successors(key: string, n: number): string[] {
    return this.successorVnodes(key, n).map((v) => v.node)
  }

  /** Same walk as `successors`, but returns the vnode at which each new node was first met. */
  successorVnodes(key: string, n: number): Vnode[] {
    if (this.size === 0) return []
    const want = Math.min(n, this.nodeList.length)
    const out: Vnode[] = []
    let i = this.lookupIndex(key)
    while (out.length < want) {
      const node = this.ownerAt(i)
      if (!out.some((v) => v.node === node)) out.push({ hash: this.hashes[i]!, node, index: i })
      i = (i + 1) % this.size
    }
    return out
  }

  /** Vnodes in ring order, for rendering. */
  entries(): Vnode[] {
    const out: Vnode[] = new Array(this.size)
    for (let i = 0; i < this.size; i++) {
      out[i] = { hash: this.hashes[i]!, node: this.nodeList[this.owners[i]!]!, index: i }
    }
    return out
  }

  /** First index whose hash is >= h, or size if none. Classic binary search. */
  private lowerBound(h: number): number {
    let lo = 0
    let hi = this.size
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (this.hashes[mid]! < h) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  private rebuild(): void {
    const total = this.nodeList.length * this.vnodes
    const pairs: [hash: number, owner: number][] = new Array(total)
    let k = 0
    for (let o = 0; o < this.nodeList.length; o++) {
      const node = this.nodeList[o]!
      for (let v = 0; v < this.vnodes; v++) pairs[k++] = [fnv1a(vnodeLabel(node, v)), o]
    }
    // Sort by hash; ties (rare) fall back to owner index so the order is deterministic.
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    this.hashes = new Uint32Array(total)
    this.owners = new Uint16Array(total)
    for (let i = 0; i < total; i++) {
      this.hashes[i] = pairs[i]![0]
      this.owners[i] = pairs[i]![1]
    }
  }
}
