import type { Dispatch } from 'react'
import { MAX_NODES, hueOf } from './palette'
import type { Mode } from './RingView'
import type { NodeInfo, TopologyAction } from './topology'

interface Props {
  nodes: NodeInfo[]
  vnodes: number
  mode: Mode
  lookupKey: string
  replication: number
  dispatch: Dispatch<TopologyAction>
  onMode: (m: Mode) => void
  onLookupKey: (k: string) => void
  onReplication: (n: number) => void
  onFocusNode: (id: string | null) => void
}

const label = 'text-[11px] uppercase tracking-[0.18em] text-amber-dim'
const field =
  'bg-panel border border-line text-amber px-2 py-1 text-[13px] outline-none focus-visible:border-amber focus-visible:ring-1 focus-visible:ring-amber/60'
const button =
  'border border-line px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] text-amber transition-colors hover:border-amber hover:text-amber-glow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-amber'

export function Controls(p: Props) {
  const full = p.nodes.length >= MAX_NODES
  return (
    <div className="flex flex-col gap-5">
      {/* nodes */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className={label}>nodes · {p.nodes.length}/{MAX_NODES}</span>
          <span className="text-[11px] text-amber-dim">hover or focus a node to isolate it</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {p.nodes.map((n) => (
            <span
              key={n.id}
              onMouseEnter={() => p.onFocusNode(n.id)}
              onMouseLeave={() => p.onFocusNode(null)}
              className="group inline-flex items-stretch border border-line hover:border-amber/70"
            >
              <span className="inline-flex items-center gap-2 px-2.5 py-1.5 text-[13px]">
                <span className="inline-block size-2.5 rounded-full" style={{ background: hueOf(n.slot) }} aria-hidden />
                node <b className="font-semibold text-amber-glow">{n.id}</b>
              </span>
              <button
                type="button"
                onClick={() => {
                  p.onFocusNode(null)
                  p.dispatch({ type: 'remove', id: n.id })
                }}
                onFocus={() => p.onFocusNode(n.id)}
                onBlur={() => p.onFocusNode(null)}
                aria-label={`remove node ${n.id}`}
                title={`remove node ${n.id}`}
                className="border-l border-line px-2 text-amber-dim transition-colors hover:bg-amber/10 hover:text-amber-glow focus-visible:bg-amber/10 focus-visible:text-amber-glow focus-visible:outline-none"
              >
                ×
              </button>
            </span>
          ))}
          <button type="button" className={button} onClick={() => p.dispatch({ type: 'add' })} disabled={full} title={full ? 'palette holds eight nodes' : 'add a node'}>
            + add node
          </button>
          {p.nodes.length === 0 && <span className="text-[12px] text-amber-dim">no nodes: every key is homeless</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        {/* vnodes */}
        <div className="flex flex-col gap-2">
          <label htmlFor="vnodes" className={label}>
            virtual nodes per node · <span className="text-amber-glow">{p.vnodes}</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              id="vnodes"
              type="range"
              min={1}
              max={200}
              value={p.vnodes}
              onChange={(e) => p.dispatch({ type: 'vnodes', value: Number(e.target.value) })}
              className="w-full accent-amber focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-amber"
            />
            <input
              type="number"
              min={1}
              max={200}
              value={p.vnodes}
              aria-label="virtual nodes per node"
              onChange={(e) => p.dispatch({ type: 'vnodes', value: Number(e.target.value) || 1 })}
              className={`${field} w-16 text-right`}
            />
          </div>
        </div>

        {/* mode */}
        <div className="flex flex-col gap-2">
          <span className={label} id="mode-label">hashing</span>
          <div role="group" aria-labelledby="mode-label" className="inline-flex border border-line">
            {(['consistent', 'modulo'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={p.mode === m}
                onClick={() => p.onMode(m)}
                className={`px-3 py-1.5 text-[12px] uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber ${
                  p.mode === m ? 'bg-amber text-ink' : 'text-amber hover:text-amber-glow'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={button} onClick={() => p.dispatch({ type: 'reset' })}>
          reset
        </button>
      </div>

      {/* lookup */}
      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="lookup" className={label}>lookup key</label>
          <input
            id="lookup"
            type="text"
            value={p.lookupKey}
            onChange={(e) => p.onLookupKey(e.target.value)}
            placeholder="type any key, or click a dot"
            spellCheck={false}
            autoComplete="off"
            className={`${field} w-full placeholder:text-amber-faint`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="replication" className={label}>replicas N</label>
          <input
            id="replication"
            type="number"
            min={1}
            max={MAX_NODES}
            value={p.replication}
            onChange={(e) => p.onReplication(Math.min(MAX_NODES, Math.max(1, Number(e.target.value) || 1)))}
            className={`${field} w-16 text-right`}
          />
        </div>
      </div>
    </div>
  )
}
