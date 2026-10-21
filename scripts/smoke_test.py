"""Browser checks with synthetic road geometry, never claimed as real road validation."""
import json, threading, http.server, functools
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
raw=(root/'data.js').read_text()
devices=json.JSONDecoder().raw_decode(raw.split('window.PEA_DATA = ',1)[1])[0]
devices=[d for d in devices if d.get('snapshot')]
cb=next(d for d in devices if d['category']=='CB')
others=[d for d in devices if d['id']!=cb['id']]
hub=others[0]
coords=lambda d:[d['lng'],d['lat']]
routes=[]
for d in others:
    points=[coords(cb),[cb['lng']+.0005,cb['lat']],coords(hub)]
    if d['id']!=hub['id']:points.append(coords(d))
    routes.append(dict(fromId=cb['id'],to=d['id'],originPoint=coords(cb),targetPoint=coords(d),coordinates=points,snappedMeters=[0,0]))
fixture=dict(version=1,rootId=cb['id'],routes=routes)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[];road_requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://server.arcgisonline.com/**',lambda r:r.abort())
    page.route('**/road-network.json',lambda r:r.fulfill(json=fixture))
    page.route('https://router.project-osrm.org/**',lambda r:(road_requests.append(r.request.url),r.abort())[-1])
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    page.wait_for_function("document.querySelector('#deviceCount').textContent==='9'")
    assert page.locator('[role=tab]').count()==0
    assert page.locator('#roadLength').inner_text()!='—'
    assert page.locator('#conductors').inner_text().count('SAC')==1
    assert 'ทั้ง Feeder SZA01' in page.locator('#wireScope').inner_text()
    initial_wire=page.locator('#conductors').inner_text()
    assert page.locator('.leaflet-connections-pane path').count()>9
    page.select_option('#selectedDevice',hub['id'])
    assert page.locator('#deviceCount').inner_text()=='8'
    assert page.locator('#conductors').inner_text()==initial_wire
    assert 'ยังระบุชนิดสาย' in page.locator('#selectedWire').inner_text()
    page.select_option('#selectedDevice',others[-1]['id'])
    assert page.locator('#deviceCount').inner_text()=='0'
    assert page.locator('#roadLength').inner_text()=='0'
    page.click('#resetRoot')
    assert page.locator('#deviceCount').inner_text()=='9'
    page.click('#boneView')
    assert page.locator('#fishbone').is_visible()
    assert page.locator('.bone-device').count()==9
    page.locator('.bone-device').first.click()
    assert page.input_value('#selectedDevice')==hub['id']
    page.click('#resetRoot');page.click('#roadView')
    assert page.locator('#fishbone').is_hidden()
    assert not road_requests,'Build cache should avoid runtime road requests'
    assert page.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/workspace/patrol-summary-desktop.png',full_page=True)
    # Missing roads must leave distance/descendants unknown; never draw straight spokes.
    fallback=browser.new_page(viewport={'width':390,'height':844})
    fallback.on('pageerror',lambda e:errors.append(str(e)))
    fallback.route('https://server.arcgisonline.com/**',lambda r:r.abort())
    fallback.route('**/road-network.json',lambda r:r.fulfill(json={'version':1,'routes':[]}))
    fallback.route('https://router.project-osrm.org/**',lambda r:r.abort())
    fallback.goto(f'http://127.0.0.1:{server.server_port}/')
    fallback.wait_for_function("document.querySelector('#traceStatus').textContent.includes('บริการถนนไม่พร้อม')")
    assert fallback.locator('.leaflet-connections-pane path').count()==0
    assert fallback.locator('#deviceCount').inner_text()=='—'
    assert fallback.locator('#roadLength').inner_text()=='—'
    fallback.click('#boneView');assert fallback.locator('.bone-device').count()==9
    fallback.click('#togglePanel')
    fallback.select_option('#dataset','all');fallback.select_option('#feeder','SZA04')
    assert 'ไม่มีตำแหน่ง CB' in fallback.locator('#traceStatus').inner_text()
    assert fallback.locator('#conductors').inner_text().find('ไม่มีทะเบียน')>=0
    assert fallback.evaluate('document.documentElement.scrollHeight<=innerHeight && document.documentElement.scrollWidth<=innerWidth')
    fallback.screenshot(path='/workspace/patrol-summary-mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
server.shutdown()
print('PASS: one-panel summary, cached road branches, selected branch and leaf, scoped material totals, fishbone selection, road failure without straight fallback, missing CB/materials, desktop/mobile viewport')
