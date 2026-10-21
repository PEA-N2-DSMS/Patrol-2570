'use strict';
const $ = id => document.getElementById(id);
const data = window.PEA_DATA;
const colors = { CB: '#ffe04a', Recloser: '#3fe6d0', SF6: '#bb8dff', Fuse: '#ffad39', 'อื่น ๆ': '#cbd5e1' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const option = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
const fmt = n => Math.round(n).toLocaleString('th-TH');
let map, markers, connections, selectedId, graph = null, currentSelection = null, mode = 'road', generation = 0, activeController, routeCache = new Map(), cachePromise = null;
let networkMessage = '', routedIds = new Set();
const materials = { 'Aerial Cable': 'SAC · สายหุ้มฉนวน', 'Partial Insulated Cable': 'PIC · หุ้มฉนวนบางส่วน', 'Bare Aluminium': 'อะลูมิเนียมเปลือย', 'Aluminium Conductor Steel Reinforce': 'ACSR · เปลือยแกนเหล็ก', 'Cross Linked Polyethylene': 'XLPE' };
function scopeData() { return $('dataset').value === 'latest' ? data.filter(d => d.snapshot) : data; }
function feederData() { return scopeData().filter(d => d.feeder === $('feeder').value); }
function rootDevice() { return feederData().find(d => d.category === 'CB'); }
function point(d) { return [d.lng, d.lat]; }
function selectedDevice() { return feederData().find(d => d.id === selectedId); }
try {
  map = L.map('map', { zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([15.986, 99.81], 14);
  const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community' }).addTo(map);
  tiles.on('tileerror', () => { $('maperror').hidden = false; $('maperror').textContent = 'ภาพดาวเทียมโหลดไม่ได้ · ตรวจการเชื่อมต่ออินเทอร์เน็ต'; });
  tiles.on('tileload', () => { $('maperror').hidden = true; });
  map.createPane('connections'); map.getPane('connections').style.zIndex = 410;
  connections = L.layerGroup().addTo(map); markers = L.featureGroup().addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
  map.on('mousemove', e => { $('coordinates').textContent = `WGS 84 · ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`; });
} catch { $('maperror').hidden = false; $('maperror').textContent = 'เปิดแผนที่ไม่ได้'; }
function fit() { if (map && markers.getLayers().length) map.fitBounds(markers.getBounds(), { padding: [65, 65], maxZoom: 16, animate: false }); }
function selectDevice(id) {
  if (!feederData().some(d => d.id === id)) return;
  selectedId = id; $('selectedDevice').value = id;
  render();
}
function renderMarkers() {
  if (!markers) return;
  markers.clearLayers();
  for (const d of feederData()) {
    if (d.lat === null || d.lng === null) continue;
    const selected = d.id === selectedId;
    const inBranch = currentSelection?.devices.includes(d.id);
    const marker = L.circleMarker([d.lat, d.lng], { radius: selected ? 13 : d.category === 'CB' ? 11 : 7, color: selected ? '#fff' : '#36124b', weight: selected ? 4 : 2, fillColor: colors[d.category], fillOpacity: !graph || selected || inBranch ? 1 : .5 });
    marker.bindTooltip(`${esc(d.name)} · ${esc(d.category)}`, { permanent: selected, direction: 'top', offset: [0, -10] });
    marker.on('click', () => selectDevice(d.id)); marker.addTo(markers);
  }
}
function selectedRows() {
  const d = selectedDevice();
  if (!d) return [];
  if (!currentSelection) return feederData().filter(x => x.id !== d.id);
  const ids = new Set(currentSelection.devices);
  return feederData().filter(x => ids.has(x.id));
}
function distanceTo(d) {
  const selected = selectedDevice(); if (!selected) return 0;
  if (graph && currentSelection && graph.terminals.has(d.id)) return Math.max(0, graph.dist.get(graph.terminals.get(d.id)) - graph.dist.get(currentSelection.start));
  return RoadNetwork.meters(point(selected), point(d));
}
function render() {
  const d = selectedDevice(); if (!d) return;
  currentSelection = RoadNetwork.selection(graph, selectedId);
  const rows = selectedRows().sort((a, b) => distanceTo(a) - distanceTo(b));
  $('maptitle').textContent = `สายป้อน ${d.feeder} · ${d.name}`;
  $('selectedType').textContent = `${d.category} · ${d.kind}`;
  $('selectedName').textContent = d.name;
  $('selectedPlace').textContent = d.place && d.place !== '-' ? d.place : d.id;
  $('roadLength').textContent = currentSelection ? fmt(currentSelection.length) : '—';
  $('deviceCount').textContent = currentSelection ? String(rows.length) : '—';
  $('scopeLabel').textContent = currentSelection ? `ขอบเขต: แขนงของต้นไม้เส้นทางถนนจาก ${d.name}` : 'ขอบเขต: ยังไม่ทราบแขนงจากจุดที่เลือก';
  $('counts').innerHTML = Object.keys(colors).map(c => `<div class="count"><b>${rows.filter(x => x.category === c).length}</b>${esc(c)}</div>`).join('');
  const unavailable = feederData().filter(x => x.id !== graph?.rootId && !routedIds.has(x.id));
  $('traceStatus').textContent = networkMessage || (currentSelection ? `แขนงถนน ${fmt(currentSelection.length)} ม. · ${rows.length} อุปกรณ์` : 'ยังไม่มีข้อมูลเส้นทางถนน');
  $('summaryWarning').textContent = currentSelection ? `จำนวนข้างต้นเป็นอุปกรณ์ในแขนงถนนจำลอง ไม่ใช่จำนวนอุปกรณ์ที่ไฟฟ้าผ่านจริง${unavailable.length ? ` · ยังไม่มีเส้นทาง ${unavailable.length} จุด ผลจึงไม่ครบทั้ง Feeder` : ''}${[...graph.offsets.values()].some(a => a.some(m => m > 100)) ? ' · มีจุดอุปกรณ์ห่างถนนเกิน 100 ม.' : ''}` : 'ยังคำนวณระยะและอุปกรณ์ถัดไปไม่ได้ รายการและจำนวนแยกประเภทด้านล่างเป็นอุปกรณ์ร่วม Feeder ทั้งหมดที่เหลือ ไม่ใช่อุปกรณ์ปลายทางหลังจุดที่เลือก';
  $('listTitle').textContent = currentSelection ? 'อุปกรณ์ในแขนงถนนจำลอง' : 'อุปกรณ์ร่วม Feeder (ยังไม่ทราบลำดับ)';
  $('total').textContent = `${rows.length} จุด`;
  renderMaterials(d);
  $('devices').replaceChildren();
  for (const row of rows) {
    const b = document.createElement('button'); b.className = 'device';
    b.innerHTML = `<span class="pill">${esc(row.category)}</span><strong>${esc(row.name)}</strong><small>${esc(row.place || row.id)}<br>${currentSelection ? 'ระยะตามต้นไม้ถนน ≈' : 'เส้นตรงเพื่อจัดเรียง ≈'} ${fmt(distanceTo(row))} ม.</small>`;
    b.onclick = () => selectDevice(row.id); $('devices').append(b);
  }
  if (!rows.length) $('devices').textContent = currentSelection ? 'ไม่มีอุปกรณ์ถัดไปในแขนงถนนจำลองนี้' : 'ไม่มีอุปกรณ์อื่นในชุดข้อมูล';
  renderMarkers(); drawRoads(); drawFishbone(rows);
}
function renderMaterials(d) {
  const items = (window.PEA_CONDUCTORS || []).filter(c => c.feeder === d.feeder);
  const grouped = {};
  for (const c of items) { const v = grouped[c.material] ||= { length: 0, count: 0 }; v.length += Number(c.length) || 0; v.count++; }
  $('wireScope').textContent = `ทั้ง Feeder ${d.feeder}`;
  $('selectedWire').textContent = `จากจุด ${d.name}: ยังระบุชนิดสายและจำนวนเมตรรายชนิดไม่ได้ เพราะทะเบียนสายไม่มีแนวเส้นหรือจุดต้น–ปลายที่เชื่อมกับอุปกรณ์`;
  $('conductors').innerHTML = items.length ? '<table><thead><tr><th>ชนิดสาย</th><th>ช่วง</th><th>เมตร*</th></tr></thead><tbody>' + Object.entries(grouped).map(([k, v]) => `<tr><td>${esc(materials[k] || k)}</td><td>${v.count}</td><td>${fmt(v.length)}</td></tr>`).join('') + '</tbody></table>' : '<p class="muted">ไม่มีทะเบียนชนิดสายของ Feeder นี้</p>';
  $('conductorSummary').textContent = items.length ? `รวมทั้ง Feeder ${fmt(Object.values(grouped).reduce((s, v) => s + v.length, 0))} ม. / ${items.length} ช่วง · ไม่ใช่ยอดจากจุดที่เลือก · *สมมติหน่วยต้นทางเป็นเมตร รอยืนยันหน่วยจาก GIS` : '';
}
function drawRoads() {
  if (!connections) return;
  connections.clearLayers(); if (!graph) return;
  // Shared road edges are drawn once; no straight spokes or straight fallback.
  for (const [child, parent] of graph.parent) {
    const a = graph.vertices.get(child).point, b = graph.vertices.get(parent).point;
    L.polyline([[a[1], a[0]], [b[1], b[0]]], { pane: 'connections', color: '#ebe2f5', weight: 4, opacity: .45, interactive: false }).addTo(connections);
  }
  if (currentSelection) for (const edge of currentSelection.lines) {
    const coords = edge.map(p => [p[1], p[0]]);
    L.polyline(coords, { pane: 'connections', color: '#2f073e', weight: 8, opacity: .95, interactive: false }).addTo(connections);
    L.polyline(coords, { pane: 'connections', color: '#ffe04a', weight: 4, opacity: 1, interactive: false }).addTo(connections);
  }
}
function drawFishbone(rows) {
  const d = selectedDevice(); if (!d) return;
  // This grouping diagram deliberately does not claim a parent/child electrical order.
  const shown = rows.slice(0, 60), width = Math.max(900, 180 + shown.length * 120), height = 520, mid = 260;
  const svg = $('boneSvg'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  let html = `<path d="M75 ${mid} H${width - 45}" stroke="#a96ee2" stroke-width="9" fill="none"/><circle cx="75" cy="${mid}" r="18" fill="${colors[d.category]}" stroke="white" stroke-width="3"/><text x="35" y="${mid + 45}" fill="white">${esc(d.name)}</text>`;
  shown.forEach((item, i) => {
    const x = 160 + i * 120, endX = x + 48, endY = i % 2 ? 390 : 130;
    html += `<g class="bone-device" data-device="${esc(item.id)}" tabindex="0" role="button" aria-label="${esc(item.name)}"><rect x="${x - 30}" y="${Math.min(mid, endY) - 45}" width="135" height="${Math.abs(mid - endY) + 105}" fill="transparent"/><path d="M${x} ${mid} L${endX} ${endY}" stroke="#c291ed" stroke-width="4"/><circle cx="${endX}" cy="${endY}" r="11" fill="${colors[item.category]}" stroke="white" stroke-width="2"/><text x="${endX - 30}" y="${endY + (i % 2 ? 32 : -25)}" fill="white" font-size="12">${esc(item.name)}</text><text x="${endX - 30}" y="${endY + (i % 2 ? 50 : -8)}" fill="#c8b2dc" font-size="10">${fmt(distanceTo(item))} ม. · ${currentSelection ? 'ถนนจำลอง' : 'เส้นตรง'}</text></g>`;
  });
  svg.innerHTML = html;
  for (const node of svg.querySelectorAll('[data-device]')) { node.onclick = () => selectDevice(node.dataset.device); node.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDevice(node.dataset.device); } }; }
  $('boneEmpty').textContent = !shown.length ? 'ไม่มีอุปกรณ์ในขอบเขตที่เลือก' : rows.length > 60 ? 'ผังแสดง 60 จุดแรก · ดูรายการครบในสรุปด้านขวา' : '';
}
function setMode(value) {
  mode = value; $('fishbone').hidden = value !== 'bone';
  $('roadView').setAttribute('aria-pressed', String(value === 'road')); $('boneView').setAttribute('aria-pressed', String(value === 'bone'));
  $('mapnotice').textContent = value === 'bone' ? 'ก้างปลาเป็นผังจัดกลุ่มอุปกรณ์ตามระยะ ไม่ใช่แผนผังการต่อวงจรจริง' : 'แนวถนนเป็นต้นไม้เส้นทางรถยนต์จำลอง ไม่ใช่แนวสายไฟฟ้าหรือผลการ Trace วงจรจริง';
  if (value === 'road' && map) requestAnimationFrame(() => map.invalidateSize());
}
async function loadBuiltCache() {
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      const response = await fetch('road-network.json', { signal: AbortSignal.timeout(12000) }); if (!response.ok) return;
      const payload = await response.json(); if (payload.version !== 1 || !Array.isArray(payload.routes)) return;
      for (const r of payload.routes) {
        const origin = data.find(d => d.id === r.fromId), target = data.find(d => d.id === r.to);
        if (!origin || !target || !Array.isArray(r.originPoint) || !Array.isArray(r.targetPoint)) continue;
        if (RoadNetwork.meters(point(origin), r.originPoint) > .1 || RoadNetwork.meters(point(target), r.targetPoint) > .1) continue;
        if (r.fromId === payload.rootId && r.coordinates?.length >= 2) routeCache.set(`${r.fromId}|${r.to}`, { ...r, from: r.fromId });
      }
    } catch { /* Runtime requests can fill a missing build cache. */ }
  })();
  return cachePromise;
}
async function loadRoads() {
  const token = ++generation;
  activeController?.abort(); activeController = new AbortController();
  const signal = activeController.signal;
  graph = null; routedIds = new Set(); connections?.clearLayers();
  const root = rootDevice(), devices = feederData().filter(d => d.lat !== null && d.lng !== null);
  if (!root) { networkMessage = 'ไม่มีตำแหน่ง CB ของ Feeder นี้ · ดูผังจัดกลุ่มก้างปลาได้'; render(); return; }
  if (devices.length > 60) { networkMessage = 'เกิน 60 จุด · เลือกชุดทดลองหรือ Feeder ที่เล็กลงก่อนคำนวณถนน'; render(); return; }
  networkMessage = 'กำลังโหลดแนวถนน…'; render(); $('reloadRoads').disabled = true;
  await loadBuiltCache(); if (token !== generation) return;
  const routes = [], missing = [];
  for (const d of devices) {
    if (d.id === root.id) continue;
    const cached = routeCache.get(`${root.id}|${d.id}`);
    if (cached) { routes.push(cached); routedIds.add(d.id); } else missing.push(d);
  }
  function apply() { if (token !== generation) return; graph = RoadNetwork.build(routes, root.id); render(); }
  if (routes.length) { networkMessage = `แนวถนนพร้อม ${routes.length}/${devices.length - 1} จุด`; apply(); }
  // Sequential requests respect the public demo service. Reuse cached results.
  let failed = 0;
  for (const d of missing) {
    if (token !== generation || signal.aborted) return;
    networkMessage = `กำลังโหลดถนน ${routes.length + failed + 1}/${devices.length - 1} · เลือกจุดเพื่อดูสรุปได้`; render();
    try {
      const timeout = AbortSignal.timeout(12000);
      const url = `https://router.project-osrm.org/route/v1/driving/${root.lng},${root.lat};${d.lng},${d.lat}?overview=full&geometries=geojson&alternatives=false`;
      const response = await fetch(url, { signal: AbortSignal.any([signal, timeout]) });
      if (!response.ok) throw Error('Routing unavailable');
      const result = await response.json(), r = result.routes?.[0];
      if (result.code !== 'Ok' || !r?.geometry?.coordinates?.length) throw Error('No route');
      if (token !== generation) return;
      const route = { from: root.id, to: d.id, coordinates: r.geometry.coordinates, snappedMeters: (result.waypoints || []).map(w => w.distance) };
      routeCache.set(`${root.id}|${d.id}`, route); routes.push(route); routedIds.add(d.id); apply();
    } catch { if (token !== generation || signal.aborted) return; failed++; if (failed >= 2 && !routes.length) break; }
    if (missing.length > 1) await new Promise(resolve => setTimeout(resolve, 350));
  }
  if (token !== generation) return;
  networkMessage = routes.length ? `แนวถนนพร้อม ${routes.length}/${devices.length - 1} จุด · แบบจำลอง ไม่ใช่วงจรไฟฟ้า` : 'บริการถนนไม่พร้อม · ไม่มีเส้นตรงทดแทน · เลือกแบบก้างปลาได้';
  graph = RoadNetwork.build(routes, root.id); $('reloadRoads').disabled = false; render();
}
function refreshScope() {
  activeController?.abort(); generation++; graph = null; routedIds = new Set();
  const feeders = [...new Set(scopeData().map(d => d.feeder))].sort(), old = $('feeder').value;
  $('feeder').innerHTML = feeders.map(f => option(f, f)).join('');
  $('feeder').value = feeders.includes(old) ? old : feeders.includes('SZA01') ? 'SZA01' : feeders[0];
  const devices = feederData(); selectedId = devices.find(d => d.category === 'CB')?.id || devices[0]?.id;
  $('selectedDevice').innerHTML = devices.map(d => option(d.id, `${d.name} · ${d.category}`)).join('');
  $('selectedDevice').value = selectedId; render(); fit(); loadRoads();
}
$('selectedDevice').onchange = () => selectDevice($('selectedDevice').value);
$('dataset').onchange = refreshScope; $('feeder').onchange = refreshScope;
$('resetRoot').onclick = () => { const root = rootDevice(); if (root) { selectDevice(root.id); fit(); } else { $('saveStatus').textContent = 'ยังไม่มีตำแหน่ง CB ในชุดข้อมูลนี้'; } };
$('reloadRoads').onclick = loadRoads; $('roadView').onclick = () => setMode('road'); $('boneView').onclick = () => setMode('bone'); $('fit').onclick = fit;
$('togglePanel').onclick = () => { const collapsed = document.body.classList.toggle('panel-collapsed'); $('togglePanel').setAttribute('aria-expanded', String(!collapsed)); requestAnimationFrame(() => map?.invalidateSize()); };
$('exportNotes').onclick = () => {
  let sections = []; try { const existing = JSON.parse(localStorage.getItem('patrol.sections.v1') || '[]'); if (Array.isArray(existing)) sections = existing; } catch { $('saveStatus').textContent = 'อ่านบันทึกเดิมไม่ได้'; return; }
  const blob = new Blob([JSON.stringify({ version: 1, sections }, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'patrol-sections.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
refreshScope();
if (matchMedia('(max-width:650px)').matches) { document.body.classList.add('panel-collapsed'); $('togglePanel').setAttribute('aria-expanded', 'false'); requestAnimationFrame(() => map?.invalidateSize()); }
