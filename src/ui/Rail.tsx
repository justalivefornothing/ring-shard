import type { ReactNode } from 'react'
import { fnv1a, hashToDegrees, hex32 } from '../core/fnv1a'
import type { LoadStats } from '../core/stats'
import { hueOf } from './palette'
import type { Mode } from './RingView'
import { KEYS, SHOWN_KEYS, type TopologyState } from './topology'

interface Props {
  state: TopologyState
  stats: LoadStats
  mode: Mode
  slotOf: Record<string, number>
  lookupKey: string
  replication: number
  focusNode: string | null
  onFocusNode: (id: string | null) => void
}

const fmt = new Intl.NumberFormat('en-US')
const pct = (f: number) => `${(f * 100).toFixed(1)}%`

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3">
      <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-amber-dim">{title}</h2>
      {children}
    </section>
  )
}

function Row({ k, v, muted = false }: { k: string; v: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-[13px]">
      <span className="text-amber-dim">{k}</span>
      <span className={`text-right tabular-nums ${muted ? 'text-amber' : 'text-amber-glow'}`}>{v}</span>
    </div>
  )
}

function Swatch({ node, slotOf }: { node: string; slotOf: Record<string, number> }) {
  return <span className="inline-block size-2.5 rounded-full align-middle" style={{ background: hueOf(slotOf[node] ?? 0) }} aria-hidden />
}

export function Rail({ state, stats, mode, slotOf, lookupKey, replication, focusNode, onFocusNode }: Props) {
  const { ring, nodes, vnodes, lastChange } = state
  const empty = ring.size === 0
  const maxCount = Math.max(1, ...stats.counts.values())

  let lookup: ReactNode
  if (!lookupKey) {
    lookup = <p className="text-[12px] text-amber-dim">type a key or click a dot on the ring.</p>
  } else if (empty) {
    lookup = <p className="text-[12px] text-amber-dim">no nodes: nothing can own this key.</p>
  } else {
    const h = fnv1a(lookupKey)
    const deg = hashToDegrees(h)
    const replicas = ring.successorVnodes(lookupKey, replication)
    const owner = replicas[0]!
    const walk = (((hashToDegrees(owner.hash) - deg) % 360) + 360) % 360
    lookup = (
      <>
        <Row k="key" v={<span className="break-all">{lookupKey}</span>} />
        <Row k="fnv1a" v={`0x${hex32(h)}`} />
        <Row k="angle" v={`${deg.toFixed(2)}°`} />
        <Row
          k="owner"
          v={
            <>
              <Swatch node={owner.node} slotOf={slotOf} /> node {owner.node}
            </>
          }
        />
        <Row k="walk" v={`${walk.toFixed(2)}° clockwise → vnode #${owner.index}`} muted />
        <Row k={`hash % ${nodes.length}`} v={`${h % nodes.length} → node ${nodes[h % nodes.length]!.id}`} muted />
        <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-amber-dim">replicas · N = {replication}</div>
        <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {replicas.map((v, i) => (
            <li key={v.index} className="tabular-nums">
              <span className="text-amber-dim">{i + 1}.</span> <Swatch node={v.node} slotOf={slotOf} /> {v.node}
            </li>
          ))}
          {replicas.length < replication && <li className="text-[12px] text-amber-dim">only {nodes.length} distinct nodes exist</li>}
        </ol>
      </>
    )
  }

  return (
    <aside className="border border-line bg-panel/60 text-[13px]" aria-label="status board">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-[0.24em] text-amber">
          status<span className="cursor" aria-hidden>▮</span>
        </span>
        <span className="text-[11px] text-amber-dim">{mode} mode</span>
      </div>

      <Section title="topology">
        <Row k="nodes" v={nodes.length} />
        <Row k="vnodes / node" v={vnodes} />
        <Row k="vnodes total" v={fmt.format(ring.size)} />
        <Row k="keys" v={`${fmt.format(KEYS.length)} · ${SHOWN_KEYS.length} drawn`} muted />
      </Section>

      <Section title="last change">
        {lastChange ? (
          <>
            <p className="mb-2 text-amber-glow">{lastChange.label}</p>
            {(
              [
                ['consistent', lastChange.ring, mode === 'consistent'],
                ['modulo', lastChange.modulo, mode === 'modulo'],
              ] as const
            ).map(([name, diff, active]) => (
              <div key={name} className="py-1">
                <div className="flex items-baseline justify-between">
                  <span className={active ? 'text-amber-glow' : 'text-amber-dim'}>{name}</span>
                  <span className="tabular-nums text-amber-glow">
                    {fmt.format(diff.moved.length)} <span className="text-amber-dim">keys</span> {pct(diff.fraction)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-line/60">
                  <div className="h-full bg-amber transition-[width] duration-500" style={{ width: pct(diff.fraction), opacity: active ? 1 : 0.45 }} />
                </div>
              </div>
            ))}
            <p className="mt-2 text-[12px] text-amber-dim">
              {lastChange.modulo.moved.length === 0
                ? 'hash % N only sees the node count, so vnode changes cost it nothing — and buy it nothing.'
                : lastChange.ring.moved.length === 0
                  ? 'no keys moved on the ring.'
                  : `modulo moved ${(lastChange.modulo.moved.length / lastChange.ring.moved.length).toFixed(1)}× as many keys for the same change.`}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-amber-dim">no changes yet — remove or add a node, or drag the vnode slider.</p>
        )}
      </Section>

      <Section title="load per node">
        {empty ? (
          <p className="text-[12px] text-amber-dim">nothing to balance.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5">
              {nodes.map((n) => {
                const c = stats.counts.get(n.id) ?? 0
                const dimmed = focusNode !== null && focusNode !== n.id
                return (
                  <li
                    key={n.id}
                    onMouseEnter={() => onFocusNode(n.id)}
                    onMouseLeave={() => onFocusNode(null)}
                    className="grid grid-cols-[1.25rem_1fr_6.5rem] items-center gap-2 tabular-nums transition-opacity"
                    style={{ opacity: dimmed ? 0.35 : 1 }}
                  >
                    <span className="text-amber-glow">{n.id}</span>
                    <span className="relative block h-1.5 bg-line/40">
                      <span className="absolute inset-y-0 left-0 rounded-r-[3px] transition-[width] duration-300" style={{ width: `${(c / maxCount) * 100}%`, background: hueOf(n.slot) }} />
                      <span className="absolute inset-y-[-3px] w-px bg-amber/70" style={{ left: `${(stats.mean / maxCount) * 100}%` }} title="ideal share" />
                    </span>
                    <span className="text-right text-[12px]">
                      {fmt.format(c)} <span className="text-amber-dim">{pct(c / KEYS.length)}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-amber-dim">σ</span>
              <span className="tabular-nums text-amber-glow">
                {stats.stddev.toFixed(1)} keys <span className="text-amber-dim">· {pct(stats.cv)} of mean {fmt.format(Math.round(stats.mean))}</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-amber-dim">amber tick marks the ideal even share. more vnodes → smaller σ.</p>
          </>
        )}
      </Section>

      <Section title="lookup">{lookup}</Section>
    </aside>
  )
}
