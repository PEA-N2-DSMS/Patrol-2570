/* Road graph only: this model does not infer electrical connectivity. */
(function (target) {
  'use strict';
  const rad = Math.PI / 180;
  function meters(a, b) {
    const p = (b[1] - a[1]) * rad, q = (b[0] - a[0]) * rad;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(p / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(q / 2) ** 2)));
  }
  const key = p => `${Number(p[0]).toFixed(6)},${Number(p[1]).toFixed(6)}`;
  function projection(p, a, b) {
    const k = Math.cos(p[1] * rad), ax = (a[0] - p[0]) * k, ay = a[1] - p[1], dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
    const t = -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1);
    const point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    return { t, distance: meters(p, point) };
  }
  function build(routes, rootId) {
    if (!routes.length) return null;
    const vertices = new Map(), edges = new Map(), terminals = new Map(), offsets = new Map();
    const valid = routes.filter(r => r.from === rootId && r.coordinates?.length >= 2 && r.coordinates.every(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90));
    if (!valid.length) return null;
    const root = valid[0].coordinates[0];
    const endpoints = [root, ...valid.map(r => r.coordinates.at(-1))];
    function vertex(p) { const k = key(p); if (!vertices.has(k)) vertices.set(k, { key: k, point: p, neighbors: new Map() }); return k; }
    function edge(a, b) {
      const ka = vertex(a), kb = vertex(b); if (ka === kb) return;
      const id = [ka, kb].sort().join('|'), length = meters(a, b);
      if (!edges.has(id)) { edges.set(id, { a: ka, b: kb, length }); vertices.get(ka).neighbors.set(kb, length); vertices.get(kb).neighbors.set(ka, length); }
    }
    for (const route of valid) {
      const points = route.coordinates;
      // A destination may lie halfway along another route segment: split there so
      // it is represented in the shared graph instead of becoming an isolated leaf.
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const split = [{ t: 0, p: a }, { t: 1, p: b }];
        for (const p of endpoints) {
          if (p[0] < Math.min(a[0], b[0]) - .00003 || p[0] > Math.max(a[0], b[0]) + .00003 || p[1] < Math.min(a[1], b[1]) - .00003 || p[1] > Math.max(a[1], b[1]) + .00003) continue;
          const hit = projection(p, a, b);
          if (hit.t > .000001 && hit.t < .999999 && hit.distance <= 2) split.push({ t: hit.t, p });
        }
        split.sort((x, y) => x.t - y.t);
        for (let j = 1; j < split.length; j++) edge(split[j - 1].p, split[j].p);
      }
      terminals.set(route.to, key(points.at(-1)));
      offsets.set(route.to, route.snappedMeters || []);
    }
    terminals.set(rootId, key(root));
    const rootKey = key(root), dist = new Map([[rootKey, 0]]), parent = new Map(), visited = new Set();
    // Dijkstra on the merged road geometry creates a shared, non-overlapping tree.
    while (true) {
      let best, score = Infinity;
      for (const [id, value] of dist) if (!visited.has(id) && value < score) { best = id; score = value; }
      if (best === undefined) break;
      visited.add(best);
      for (const [next, weight] of vertices.get(best).neighbors) {
        if (score + weight < (dist.get(next) ?? Infinity)) { dist.set(next, score + weight); parent.set(next, best); }
      }
    }
    // Remove road stubs that do not lead to any routed device.
    const used = new Set([rootKey]);
    for (const terminal of terminals.values()) {
      let node = terminal;
      while (node && !used.has(node)) { used.add(node); node = parent.get(node); }
    }
    for (const child of parent.keys()) if (!used.has(child)) parent.delete(child);
    const children = new Map();
    for (const [child, p] of parent) { if (!children.has(p)) children.set(p, []); children.get(p).push(child); }
    return { vertices, edges, terminals, offsets, rootId, rootKey, dist, parent, children };
  }
  function selection(graph, id) {
    const start = graph?.terminals.get(id);
    if (!start || !graph.dist.has(start)) return null;
    const nodes = new Set(), stack = [start], lines = [];
    let length = 0;
    while (stack.length) {
      const n = stack.pop(); if (nodes.has(n)) continue; nodes.add(n);
      for (const c of graph.children.get(n) || []) {
        stack.push(c); const a = graph.vertices.get(n).point, b = graph.vertices.get(c).point;
        length += meters(a, b); lines.push([a, b]);
      }
    }
    const devices = [...graph.terminals].filter(([deviceId, node]) => deviceId !== id && nodes.has(node)).map(([deviceId]) => deviceId);
    return { nodes, devices, lines, length, start };
  }
  const api = { build, selection, meters, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else target.RoadNetwork = api;
})(typeof window === 'undefined' ? globalThis : window);
