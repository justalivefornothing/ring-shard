/**
 * Eight categorical hues for the near-black surface (#0b0a08), in a fixed
 * order validated for adjacent-pair colour-vision-deficiency separation
 * (worst adjacent ΔE 14.6 protan, 17.7 normal). A node keeps its slot for
 * life, so removing a neighbour never repaints the survivors.
 */
export const NODE_HUES = [
  '#1c9bb8', // cyan
  '#3da03a', // green
  '#8f7ff0', // violet
  '#d0508a', // magenta
  '#4a90e2', // ice blue
  '#e0605a', // coral
  '#7d74e6', // indigo
  '#17a58c', // teal
] as const

export const MAX_NODES = NODE_HUES.length

export const NODE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const

export const AMBER = '#e6a23c'
export const AMBER_GLOW = '#ffd27a'
export const INK = '#0b0a08'
export const LINE = '#2a2618'

export function hueOf(slot: number): string {
  return NODE_HUES[slot % MAX_NODES]!
}
