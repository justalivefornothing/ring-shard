import { useMemo } from 'react'
import { fnv1a, hashToDegrees, hex32 } from '../core/fnv1a'
import type { Vnode } from '../core/ring'
import { AMBER, AMBER_GLOW, INK, LINE, hueOf } from './palette'
import { SHOWN_KEYS, type TopologyState } from './topology'

export type Mode = 'consistent' | 'modulo'

const SIZE = 600
const C = SIZE / 2
const R = 222 // band radius
const BAND = 12
const DOT_R = R - 26
const WALK_R = R + 30
const REPLICA_R = R + 48
const LABEL_R = R + 66
/** Minimum angular gap between replica badges so neighbouring successors stay legible. */
const BADGE_GAP = 5

function polar(deg: number, r: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

/** Clockwise SVG arc from `fromDeg` to `toDeg` at radius r. */
function arcPath(fromDeg: number, toDeg: number, r: number): string {
  const span = (((toDeg - fromDeg) % 360) + 360) % 360
  const [x0, y0] = polar(fromDeg, r)
  const [x1, y1] = polar(toDeg, r)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x1} ${y1}`
}

interface Run {
  node: string
  fromDeg: number
  toDeg: number
  full: boolean
}

/** Merge consecutive vnodes with the same owner into one arc (keys in (prev, this] go to `this`). */
function ownerRuns(entries: Vnode[]): Run[] {
  const n = entries.length
  if (n === 0) return []
  const at = (i: number) => entries[(i + n) % n]!
  let start = -1
  for (let i = 0; i < n; i++) if (at(i - 1).node !== at(i).node) { start = i; break }
  if (start === -1) return [{ node: at(0).node, fromDeg: 0, toDeg: 360, full: true }]
  const runs: Run[] = []
  let i = start
  do {
    const node = at(i).node
    let j = i
    while (at(j + 1).node === node && (j + 1) % n !== start) j = (j + 1) % n
    runs.push({ node, fromDeg: hashToDegrees(at(i - 1).hash), toDeg: hashToDegrees(at(j).hash), full: false })
    i = (j + 1) % n
  } while (i !== start)
  return runs
}

const keyHash = new Map<string, number>()
function hashOf(key: string): number {
  let h = keyHash.get(key)
  if (h === undefined) keyHash.set(key, (h = fnv1a(key)))
  return h
}

interface Props {
  state: TopologyState
  mode: Mode
  slotOf: Record<string, number>
  lookupKey: string
  replication: number
  focusNode: string | null
  onPickKey: (key: string) => void
}

export function RingView({ state, mode, slotOf, lookupKey, replication, focusNode, onPickKey }: Props) {
  const { ring, owners, modOwners, lastChange } = state
  const entries = useMemo(() => ring.entries(), [ring])
  const runs = useMemo(() => ownerRuns(entries), [entries])
  const empty = ring.size === 0
  const consistent = mode === 'consistent'
  const current = consistent ? owners : modOwners
  const color = (node: string | undefined) => (node === undefined ? LINE : hueOf(slotOf[node] ?? 0))
  const dim = (node: string | undefined) => (focusNode !== null && node !== focusNode ? 0.18 : 1)

  const ghosts = useMemo(() => {
    if (!lastChange) return []
    const moved = new Set((consistent ? lastChange.ring : lastChange.modulo).moved)
    return SHOWN_KEYS.filter((k) => moved.has(k)).map((k) => {
      const from = hashToDegrees(hashOf(k))
      const owner = current[k]
      let to = from
      if (consistent && owner !== undefined) {
        to = hashToDegrees(entries[ring.lookupIndex(k)]!.hash)
        if (to < from) to += 360
      }
      return { key: k, from, to, node: owner }
    })
  }, [lastChange, consistent, current, entries, ring])

  const lookup = useMemo(() => {
    if (!lookupKey || empty) return null
    const h = hashOf(lookupKey)
    const deg = hashToDegrees(h)
    if (!consistent) return { deg, walk: null, replicas: [] as (Vnode & { actual: number; badge: number })[] }
    const vnodes = ring.successorVnodes(lookupKey, Math.max(1, replication))
    const ownerDeg = hashToDegrees(vnodes[0]!.hash)
    // Badges walk clockwise from the owner; push each one past its predecessor so they never overlap.
    let last = -Infinity
    const replicas = vnodes.map((v) => {
      let actual = hashToDegrees(v.hash)
      while (actual < ownerDeg - 1e-9) actual += 360 // unwrap so the walk is monotone
      const badge = Math.max(actual, last + BADGE_GAP)
      last = badge
      return { ...v, actual, badge }
    })
    return { deg, walk: { ownerDeg, node: vnodes[0]!.node }, replicas }
  }, [lookupKey, empty, consistent, ring, replication])

  const changeFraction = lastChange ? (consistent ? lastChange.ring : lastChange.modulo).fraction : null

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={
        empty
          ? 'Empty hash ring'
          : `Hash ring with ${ring.nodes.length} nodes and ${ring.size} virtual nodes; ${SHOWN_KEYS.length} sample keys drawn`
      }
      className="block h-auto w-full max-w-[640px] select-none"
    >
      {/* base circle */}
      <circle cx={C} cy={C} r={R} fill="none" stroke={LINE} strokeWidth={empty || !consistent ? 1 : BAND} strokeDasharray={empty ? '3 6' : undefined} />

      {/* owner arcs + vnode ticks (consistent mode only: modulo ownership is not contiguous) */}
      {consistent && (
        <g>
          {runs.map((r, i) =>
            r.full ? (
              <circle key={i} cx={C} cy={C} r={R} fill="none" stroke={color(r.node)} strokeWidth={BAND} opacity={dim(r.node)} />
            ) : (
              <path key={i} d={arcPath(r.fromDeg, r.toDeg, R)} fill="none" stroke={color(r.node)} strokeWidth={BAND} opacity={dim(r.node)} />
            ),
          )}
          {entries.map((v) => {
            const d = hashToDegrees(v.hash)
            const [x0, y0] = polar(d, R + BAND / 2 + 2)
            const [x1, y1] = polar(d, R + BAND / 2 + 9)
            return <line key={v.index} x1={x0} y1={y0} x2={x1} y2={y1} stroke={color(v.node)} strokeWidth={1} opacity={dim(v.node)} />
          })}
        </g>
      )}

      {/* degree marks */}
      {[0, 90, 180, 270].map((d) => {
        const [x, y] = polar(d, LABEL_R)
        return (
          <text key={d} x={x} y={y} fill={AMBER} opacity={0.55} fontSize={11} textAnchor="middle" dominantBaseline="middle" className="font-mono">
            {d}°
          </text>
        )
      })}

      {/* key dots */}
      {!empty &&
        SHOWN_KEYS.map((k) => {
          const owner = current[k]
          const [x, y] = polar(hashToDegrees(hashOf(k)), DOT_R)
          return (
            <circle
              key={k}
              cx={x}
              cy={y}
              r={4}
              fill={color(owner)}
              stroke={INK}
              strokeWidth={1.5}
              opacity={dim(owner)}
              className="cursor-pointer transition-[r] hover:[r:6px]"
              onClick={() => onPickKey(k)}
            >
              <title>{`${k} · 0x${hex32(hashOf(k))} · ${owner ?? '—'}`}</title>
            </circle>
          )
        })}

      {/* moved keys: slide clockwise to their new owner (consistent) or scatter outward (modulo) */}
      {!empty && (
        <g>
          {ghosts.map((g) => (
            <g
              key={`${lastChange!.epoch}-${mode}-${g.key}`}
              className={consistent ? 'ghost ghost-slide' : 'ghost ghost-scatter'}
              style={{ ['--from' as string]: `${g.from}deg`, ['--to' as string]: `${g.to}deg` }}
            >
              <circle cx={C} cy={C - DOT_R} r={4.5} fill={color(g.node)} stroke={INK} strokeWidth={1} />
            </g>
          ))}
        </g>
      )}

      {/* lookup: hash marker, clockwise walk, replicas */}
      {lookup && (
        <g>
          {lookup.walk && (
            <>
              <path d={arcPath(lookup.deg, lookup.walk.ownerDeg, WALK_R)} fill="none" stroke={AMBER} strokeWidth={2} strokeLinecap="round" />
              <line
                x1={polar(lookup.walk.ownerDeg, R - BAND)[0]}
                y1={polar(lookup.walk.ownerDeg, R - BAND)[1]}
                x2={polar(lookup.walk.ownerDeg, WALK_R + 4)[0]}
                y2={polar(lookup.walk.ownerDeg, WALK_R + 4)[1]}
                stroke={AMBER_GLOW}
                strokeWidth={2}
              />
            </>
          )}
          <line
            x1={polar(lookup.deg, DOT_R - 16)[0]}
            y1={polar(lookup.deg, DOT_R - 16)[1]}
            x2={polar(lookup.deg, WALK_R + 4)[0]}
            y2={polar(lookup.deg, WALK_R + 4)[1]}
            stroke={AMBER}
            strokeWidth={1}
          />
          <g transform={`translate(${polar(lookup.deg, DOT_R).join(' ')}) rotate(45)`}>
            <rect x={-6} y={-6} width={12} height={12} fill={INK} stroke={AMBER_GLOW} strokeWidth={2} />
          </g>
          {lookup.replicas.map((v, i) => {
            const [x, y] = polar(v.badge, REPLICA_R)
            const [tx, ty] = polar(v.actual, R + BAND / 2 + 9)
            const [lx, ly] = polar(v.badge, REPLICA_R - 9)
            return (
              <g key={v.index}>
                <line x1={tx} y1={ty} x2={lx} y2={ly} stroke={color(v.node)} strokeWidth={1} opacity={0.8} />
                <circle cx={x} cy={y} r={9} fill={INK} stroke={color(v.node)} strokeWidth={1.5} />
                <text x={x} y={y + 0.5} fill={AMBER_GLOW} fontSize={10} fontWeight={600} textAnchor="middle" dominantBaseline="middle" className="font-mono">
                  {i + 1}
                </text>
              </g>
            )
          })}
        </g>
      )}

      {/* centre readout */}
      <g className="font-mono" textAnchor="middle">
        {empty ? (
          <>
            <text x={C} y={C - 8} fill={AMBER} fontSize={18} fontWeight={600} letterSpacing={2}>RING EMPTY</text>
            <text x={C} y={C + 18} fill={AMBER} opacity={0.6} fontSize={12}>add a node to place keys</text>
          </>
        ) : changeFraction !== null ? (
          <>
            <text x={C} y={C - 30} fill={AMBER} opacity={0.6} fontSize={11} letterSpacing={2}>{lastChange!.label.toUpperCase()}</text>
            <text x={C} y={C + 12} fill={AMBER_GLOW} fontSize={44} fontWeight={600}>{(changeFraction * 100).toFixed(1)}%</text>
            <text x={C} y={C + 38} fill={AMBER} opacity={0.75} fontSize={12}>of keys moved · {consistent ? 'consistent' : 'modulo'} hashing</text>
          </>
        ) : (
          <>
            <text x={C} y={C - 10} fill={AMBER_GLOW} fontSize={22} fontWeight={600}>{ring.nodes.length} nodes · {ring.size} vnodes</text>
            <text x={C} y={C + 16} fill={AMBER} opacity={0.6} fontSize={12}>remove a node to see what moves</text>
          </>
        )}
      </g>
    </svg>
  )
}
