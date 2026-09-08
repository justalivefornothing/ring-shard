# Ringshard — plan

A consistent-hashing ring where you add and remove nodes and see exactly which
keys move, versus the carnage of modulo hashing.

## Goal

Make the one idea behind consistent hashing *visible*: when the topology
changes, only the keys that hashed into the departed (or arriving) node's arcs
move. Everything else stays put. Put that next to `hash % N`, where almost
everything moves, and the point makes itself.

## Features

1. FNV-1a 32-bit hash written from scratch; keys and virtual nodes placed on a
   360-degree SVG ring.
2. Add / remove nodes with a configurable virtual-node count (1-200); every
   node owns a distinct, fixed hue on its arcs, ticks and dots.
3. Key lookup: type a key, see its hash position and the clockwise walk to the
   owning vnode.
4. Remap diff after any topology change: count and percentage of keys moved,
   animated as dots sliding to their new owner.
5. Per-node load histogram with a standard-deviation readout.
6. Modulo-hashing comparison panel showing the remap percentage for the same
   change.
7. Replication factor N: the N distinct successor nodes for a key.

## Architecture

```
src/
  core/
    fnv1a.ts        FNV-1a 32-bit, string -> uint32
    ring.ts         Ring class: sorted Uint32Array of vnode hashes + owner
                    indices, binary-search lookup with wraparound, successors(N)
    remap.ts        ownersOf(), diffOwners(), moduloOwners(), moduloRemapFraction()
    stats.ts        per-node counts, standard deviation
    keys.ts         deterministic sample key generator (key-0000 .. key-NNNN)
    *.test.ts       vitest
  ui/
    App.tsx         state: nodes, vnodes, keys, lookup key, N; derives ring + diffs
    RingView.tsx    SVG ring: arcs per owner, vnode ticks, key dots, lookup walk
    Rail.tsx        right-hand status board: remap readout, histogram, modulo panel,
                    replication list
    Controls.tsx    add/remove node, vnode slider, key input, N selector
    palette.ts      8 fixed categorical hues validated for the dark surface
```

The ring is purely derived data: `useMemo(() => new Ring(nodes, vnodes))`.
A topology change keeps the *previous* owner map in a ref, diffs it against
the new one, and hands the moved set to `RingView`, which animates those dots
from their old angle to their new one via CSS transitions on `transform`.

## Milestones

1. Plan, license, scaffold.
2. Core: fnv1a, Ring, remap, stats — tests green.
3. Ring SVG + controls (add/remove, vnodes, hues).
4. Lookup walk, remap animation, histogram, modulo panel, replication.
5. Polish: typography, responsive layout, keyboard, empty states, smoke test.
6. README, publish.
