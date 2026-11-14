// Levels are addressed by biome, not by number: appending a biome reshuffles
// which biome every level number is, and a test pinned to "level 38 is the
// Ruins" breaks on the next biome. This finds the first level of a biome whose
// generated world satisfies `pred`. Sim's biomeIndex is the rule (a cycle of
// twenty, with every twenty-first level the North Pole).
export function levelWith(S, biome, pred = () => true, seed = 3, tries = 60) {
  const index = S.BIOMES.indexOf(biome)
  if (index < 0) throw new Error("no biome " + biome)
  for (let level = 1, k = 0; k < tries; level++) {
    if (S.biomeIndex(level) !== index) continue
    k++
    const w = S.generate(level, 0, seed)
    if (pred(w, level)) return level
  }
  throw new Error(`no ${biome} level satisfies the predicate`)
}

// The first `count` levels of a biome, in order, from `from` on.
export function levelsOf(S, biome, count, from = 1) {
  const index = typeof biome === "number" ? biome : S.BIOMES.indexOf(biome), out = []
  for (let level = from; out.length < count; level++) if (S.biomeIndex(level) === index) out.push(level)
  return out
}
