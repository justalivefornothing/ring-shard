import { Ring } from '../core/ring'
import { diffOwners, moduloOwners, ownersOf, type OwnerMap, type RemapDiff } from '../core/remap'
import { sampleKeys } from '../core/stats'
import { MAX_NODES, NODE_NAMES } from './palette'

export const KEYS: readonly string[] = sampleKeys(10_000)
/** Every 42nd key is drawn on the ring; the stats always use all 10,000. */
export const SHOWN_KEYS: readonly string[] = KEYS.filter((_, i) => i % 42 === 0)

export interface NodeInfo {
  id: string
  /** Palette slot, fixed for the node's lifetime. */
  slot: number
}

export interface Change {
  epoch: number
  label: string
  ring: RemapDiff
  modulo: RemapDiff
  prevOwners: OwnerMap
  prevModOwners: OwnerMap
}

export interface TopologyState {
  nodes: NodeInfo[]
  vnodes: number
  ring: Ring
  owners: OwnerMap
  modOwners: OwnerMap
  lastChange: Change | null
}

export type TopologyAction =
  | { type: 'add' }
  | { type: 'remove'; id: string }
  | { type: 'vnodes'; value: number }
  | { type: 'reset' }

function derive(nodes: NodeInfo[], vnodes: number) {
  const ids = nodes.map((n) => n.id)
  const ring = new Ring(ids, vnodes)
  return { ring, owners: ownersOf(ring, KEYS), modOwners: moduloOwners(KEYS, ids) }
}

export function initialTopology(): TopologyState {
  const nodes = NODE_NAMES.slice(0, 4).map((id, slot) => ({ id, slot }))
  return { nodes, vnodes: 100, ...derive(nodes, 100), lastChange: null }
}

function transition(state: TopologyState, nodes: NodeInfo[], vnodes: number, label: string): TopologyState {
  const next = derive(nodes, vnodes)
  const lastChange: Change = {
    epoch: (state.lastChange?.epoch ?? 0) + 1,
    label,
    ring: diffOwners(state.owners, next.owners, KEYS),
    modulo: diffOwners(state.modOwners, next.modOwners, KEYS),
    prevOwners: state.owners,
    prevModOwners: state.modOwners,
  }
  return { nodes, vnodes, ...next, lastChange }
}

export function topologyReducer(state: TopologyState, action: TopologyAction): TopologyState {
  switch (action.type) {
    case 'add': {
      if (state.nodes.length >= MAX_NODES) return state
      const used = new Set(state.nodes.map((n) => n.slot))
      const slot = [...Array(MAX_NODES).keys()].find((s) => !used.has(s))!
      const id = NODE_NAMES.find((name) => !state.nodes.some((n) => n.id === name))!
      return transition(state, [...state.nodes, { id, slot }], state.vnodes, `added node ${id}`)
    }
    case 'remove': {
      if (!state.nodes.some((n) => n.id === action.id)) return state
      const nodes = state.nodes.filter((n) => n.id !== action.id)
      return transition(state, nodes, state.vnodes, `removed node ${action.id}`)
    }
    case 'vnodes': {
      const value = Math.min(200, Math.max(1, Math.round(action.value)))
      if (value === state.vnodes) return state
      return transition(state, state.nodes, value, `vnodes ${state.vnodes} → ${value}`)
    }
    case 'reset':
      return initialTopology()
  }
}
