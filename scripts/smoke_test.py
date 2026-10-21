from playwright.sync_api import sync_playwright
import json, threading, http.server, functools
from pathlib import Path
root=Path(__file__).resolve().parents[1]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('https://server.arcgisonline.com/**',lambda r:r.abort())
    page.goto(f'http://127.0.0.1:{server.server_port}/')
    assert page.locator('.device').count()==10
    assert page.locator('#conductorSummary').inner_text().startswith('152')
    assert page.locator('.leaflet-connections-pane path').count()==18
    page.select_option('#category','Fuse')
    assert page.locator('.device').count()==6
    page.click('#rootNode')
    assert page.locator('.device').count()==10
    assert page.locator('.leaflet-connections-pane path').count()==18
    page.uncheck('#showConnections');assert page.locator('.leaflet-connections-pane path').count()==0
    page.check('#showConnections')
    assert page.evaluate('document.documentElement.scrollHeight<=innerHeight')
    page.select_option('#dataset','all')
    page.select_option('#feeder','')
    assert page.locator('.device').count()==386
    assert page.locator('.leaflet-interactive').count()==386
    page.locator('[data-tab=equipment]').click();page.select_option('#feeder','SZA04')
    assert page.locator('.device').count()==46
    assert page.locator('#counts').inner_text().split()==['0','CB','2','Recloser','5','SF6','23','Fuse','16','อื่น','ๆ'],page.locator('#counts').inner_text()
    page.select_option('#category','Recloser')
    assert page.locator('.device').count()==2
    page.locator('.device').first.click()
    assert page.locator('.leaflet-popup').is_visible()
    page.locator('.popup button').first.click()
    assert page.input_value('#from')!=''
    page.locator('[data-tab=equipment]').click();page.select_option('#category','')
    page.fill('#search','หาดชะอม')
    assert page.locator('.device').count()>0
    page.fill('#search','')
    ids=page.locator('#from option').evaluate_all('(els)=>els.map(e=>e.value).filter(Boolean)')
    page.locator('[data-tab=planner]').click();page.select_option('#from',ids[0]);page.select_option('#to',ids[1])
    page.route('https://router.project-osrm.org/**',lambda r:r.fulfill(json={'code':'Ok','routes':[{'distance':3456,'geometry':{'type':'LineString','coordinates':[[99.86,16.07],[99.87,16.04]]}}],'waypoints':[{'distance':15},{'distance':21}]}))
    page.locator('[data-tab=planner]').click();page.click('#route');page.wait_for_function("document.querySelector('#distance').textContent.includes('3.46')")
    page.locator('[data-tab=planner]').click();page.fill('#note','ทดสอบงานตัดต้นไม้ <script>alert(1)</script>')
    page.select_option('#wire','สายเปลือย')
    page.locator('[data-tab=planner]').click();page.click('#record button')
    assert page.locator('.record').count()==1
    page.reload();assert page.locator('.record').count()==1
    page.locator('[data-tab=equipment]').click();page.select_option('#dataset','all');page.locator('[data-tab=equipment]').click();page.select_option('#feeder','SZA04')
    assert '<script>' in page.locator('.record').text_content()
    page.locator('[data-tab=planner]').click();page.select_option('#from',ids[0]);page.select_option('#to',ids[1])
    page.unroute('https://router.project-osrm.org/**')
    page.route('https://router.project-osrm.org/**',lambda r:r.abort())
    page.locator('[data-tab=planner]').click();page.click('#route');page.wait_for_function("document.querySelector('#distance').textContent.includes('คำนวณถนนไม่ได้')")
    page.locator('[data-tab=planner]').click();page.fill('#note','test');page.locator('[data-tab=planner]').click();page.click('#record button')
    assert page.locator('.record').count()==1
    page.locator('[data-tab=equipment]').click();page.select_option('#feeder','SZA04');page.locator('[data-tab=planner]').click();page.locator('[data-tab=planner]').click();page.select_option('#from',ids[0]);page.select_option('#to',ids[0]);page.locator('[data-tab=planner]').click();page.click('#route')
    assert 'คนละตัว' in page.locator('#distance').inner_text()
    page.locator('[data-tab=notes]').click();page.locator('#import').set_input_files({'name':'notes.json','mimeType':'application/json','buffer':json.dumps({'version':1,'sections':[{'from':ids[0],'to':ids[1],'feeder':'SZA04','date':'2026-10-21','wire':'สายเปลือย','note':'imported','roadKm':2.0,'source':'OSRM driving'}]}).encode()})
    page.wait_for_function("document.querySelectorAll('.record').length===2")
    page.locator('[data-tab=equipment]').click();page.select_option('#dataset','latest');page.select_option('#feeder','SZA01');page.select_option('#category','');page.click('#rootNode');page.screenshot(path='/workspace/patrol-desktop.png',full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth && document.documentElement.scrollHeight<=window.innerHeight')
    page.screenshot(path='/tmp/patrol-mobile.png',full_page=True)
    assert not errors,errors
    browser.close()
server.shutdown()
print('PASS: 386 merged map points / 10 latest SZA01, feeder/category/search, popup selection, mocked road route, safe notes/persistence, routing failure, identical endpoints, mobile layout')
