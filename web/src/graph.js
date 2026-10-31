// Map graph helpers (links carry source/target nodes with .id). adjacency: id -> [[otherId, link], ...] in link order.
export const adjacency = (links) => {
  const m = new Map(), add = (a, b, l) => { const e = m.get(a); if (e) e.push([b, l]); else m.set(a, [[b, l]]); };
  for (const l of links) { add(l.source.id, l.target.id, l); add(l.target.id, l.source.id, l); }
  return m;
};
// breadth-first shortest path from `from` back to `to`, as links ordered `to` first (empty when unreachable)
export const shortestPath = (adj, from, to) => {
  const prev = new Map([[from, null]]), q = [from];
  for (let i = 0; i < q.length && !prev.has(to); i++) for (const [y, l] of adj.get(q[i]) || []) if (!prev.has(y)) { prev.set(y, l); q.push(y); }
  const out = []; for (let c = to, l; (l = prev.get(c)); c = l.source.id === c ? l.target.id : l.source.id) out.push(l); return out;
};
