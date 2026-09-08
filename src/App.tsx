import { useMemo, useReducer, useState } from 'react'
import { loadStats } from './core/stats'
import { Controls } from './ui/Controls'
import { Rail } from './ui/Rail'
import { RingView, type Mode } from './ui/RingView'
import { KEYS, initialTopology, topologyReducer } from './ui/topology'

export default function App() {
  const [state, dispatch] = useReducer(topologyReducer, undefined, initialTopology)
  const [mode, setMode] = useState<Mode>('consistent')
  const [lookupKey, setLookupKey] = useState('user:42')
  const [replication, setReplication] = useState(3)
  const [focusNode, setFocusNode] = useState<string | null>(null)

  const slotOf = useMemo(() => Object.fromEntries(state.nodes.map((n) => [n.id, n.slot])), [state.nodes])
  const ids = useMemo(() => state.nodes.map((n) => n.id), [state.nodes])
  const stats = useMemo(
    () => loadStats(mode === 'consistent' ? state.owners : state.modOwners, ids, KEYS),
    [mode, state.owners, state.modOwners, ids],
  )

  return (
    <div className="min-h-screen bg-ink font-mono text-amber">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-3 sm:px-6">
        <h1 className="text-[15px] font-semibold tracking-[0.3em] text-amber-glow">
          RINGSHARD<span className="text-amber-dim">//</span>
          <span className="text-[11px] font-normal tracking-[0.18em] text-amber-dim">consistent hashing, visibly</span>
        </h1>
        <p className="text-[12px] text-amber-dim">
          remove a node: the ring moves ~1/N of the keys. <span className="text-amber">hash % N</span> moves most of them.
        </p>
      </header>

      <main className="mx-auto grid max-w-[1240px] grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-5" aria-label="ring">
          <div className="flex justify-center">
            <RingView
              state={state}
              mode={mode}
              slotOf={slotOf}
              lookupKey={lookupKey}
              replication={replication}
              focusNode={focusNode}
              onPickKey={setLookupKey}
            />
          </div>
          <Controls
            nodes={state.nodes}
            vnodes={state.vnodes}
            mode={mode}
            lookupKey={lookupKey}
            replication={replication}
            dispatch={dispatch}
            onMode={setMode}
            onLookupKey={setLookupKey}
            onReplication={setReplication}
            onFocusNode={setFocusNode}
          />
        </section>

        <Rail
          state={state}
          stats={stats}
          mode={mode}
          slotOf={slotOf}
          lookupKey={lookupKey}
          replication={replication}
          focusNode={focusNode}
          onFocusNode={setFocusNode}
        />
      </main>

      <footer className="px-4 pb-6 text-[11px] text-amber-dim sm:px-6">
        fnv-1a 32-bit · sorted uint32 vnode array · binary-search lookup with wraparound · {KEYS.length.toLocaleString('en-US')} sample keys
      </footer>
    </div>
  )
}
