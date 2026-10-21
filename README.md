# PATROLMAP · SZA01
Single-screen satellite dashboard for the supplied PEA exports. The right panel summarizes the selected device, an approximate road branch, device counts, and conductor-register totals in meters. Road view and a fishbone grouping diagram are available from the toolbar.

## Run
Use the existing checkout; do not create a worktree unless requested.

```sh
cd /workspace/Patrol-2570
python3 -m http.server 8000 --bind 0.0.0.0
```

No build or package installation is needed for the static website. Leaflet 1.9.4 is vendored (BSD-2-Clause, vendor/LICENSE). Satellite tiles use Esri World Imagery and retain provider attribution. Map zoom is capped at 18; native tile requests are capped at 17 and enlarged at the last zoom level to avoid requesting unavailable high-resolution imagery. Availability can still vary by coverage area.

## Meaning of the results
- Latest SZA01 snapshot: CB 1, SF6 2, Fuse 6, Disconnecting 1. The merged archive has 386 unique device TAGs. Shared TAGs use the latest export; extra devices in the earlier snapshot remain in the merged mode.
- OSRM driving routes from the CB to the feeder's devices are merged into a road graph. Shared road segments are counted once. A shortest-path tree organizes that road graph; selecting an equipment snap point highlights its descendant road branch. Equipment snap points inside shared edges are inserted before building the tree.
- **This is a road model, not electrical connectivity.** Device counts and distances refer to the modeled road branch, not confirmed equipment downstream of a protection device. Routing may take vehicle detours. Points snapped more than 100 m away and incomplete routing are flagged.
- The fishbone display groups equipment by modeled road distance (or explicitly labeled straight-line distance if routing is unavailable). Its spine and stems are a schematic layout, not equipment connection order or conductor geometry.
- No straight spokes are used as a map fallback. Missing routes show unknown branch distance/count. Other equipment in the feeder is then listed as feeder membership only.
- Conductor lengths/materials are **whole-feeder register totals**. SZA01 has 152 MV records totaling approximately 12,159.583 meters, assuming the export's length unit is meters (requires source GIS confirmation). SAC 100 records, PIC 30, Bare Aluminium 15, ACSR 6, XLPE 1. These exports lack conductor geometry and endpoint relationships, so per-selected-device material lengths remain unknown. Do not allocate whole-feeder lengths proportionally to road branches.
- To compute actual line lengths, conductor types by selected branch, and electrical equipment order, import authoritative conductor geometry with device/node endpoint IDs, topology, normal switch states, and confirmed units.

## Road cache and network
GitHub Pages workflow builds `road-network.json` using `scripts/build_roads.py`. It queries public OSRM once per SZA01 destination, sequentially with a one-second pause, and retains TLS verification. Only equipment coordinates are sent, not customer or employee data. This shares the equipment coordinates with the public routing provider. Cached road geometry is bundled with the website. Unavailable routes are recorded, not fabricated. The browser can request missing routes sequentially and reuse successful results in memory. Failed initial service access stops after two failures.

Required HTTPS destinations: `server.arcgisonline.com` (satellite), `router.project-osrm.org` (road routing). A public demo routing service has no availability guarantee; use an approved provider for operational use. A changed equipment export requires rebuilding the cache. Browser retries validate cached endpoints against current equipment coordinates.

## Stored notes
The simplified UI no longer creates inspection records. Previously saved notes remain untouched in browser localStorage and can be exported using the button at the bottom of the summary. No account, server-side database or cross-device sync is provided.

## Data import
`python3 scripts/import_excel.py <recloser.xlsx> <switch.xlsx> <latest-feeder.xlsx>` uses Python openpyxl. Only map and conductor-register fields are retained. Customer meter and employee fields are excluded.

## Tests
```sh
node --check app.js
node scripts/test_network.js
python3 scripts/smoke_test.py
```
Browser tests require Playwright and `/usr/bin/chromium`. They use synthetic road fixtures to verify merged lengths, branch selection, scope labeling, schematic interaction, missing routes, missing CB/register and viewport size. They do not establish real-road correctness.

## Publish
Push to main triggers `.github/workflows/pages.yml`; repository Pages source must be GitHub Actions. Only static web files, vendor assets and the road cache are published, not original Excel files. Deployment success and road-cache completeness must be checked independently.
