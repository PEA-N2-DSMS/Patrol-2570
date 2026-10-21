"""Cache public OSRM road routes for the SZA01 demo. Never infer conductor topology."""
import argparse, json, time, urllib.request
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--output',default='road-network.json')
args=parser.parse_args()
text=Path(__file__).resolve().parents[1].joinpath('data.js').read_text()
devices=json.JSONDecoder().raw_decode(text.split('window.PEA_DATA = ',1)[1])[0]
devices=[d for d in devices if d.get('snapshot') and d['feeder']=='SZA01']
root=next(d for d in devices if d['category']=='CB')
routes=[];failed=[]
for d in devices:
    if d['id']==root['id']: continue
    url=f"https://router.project-osrm.org/route/v1/driving/{root['lng']},{root['lat']};{d['lng']},{d['lat']}?overview=full&geometries=geojson&alternatives=false"
    try:
        req=urllib.request.Request(url,headers={'User-Agent':'Patrol-SZA01-Demo/1.0 (public road geometry cache)'})
        with urllib.request.urlopen(req,timeout=20) as response: obj=json.load(response)
        assert obj['code']=='Ok' and obj['routes'], 'No road route'
        route=obj['routes'][0]
        routes.append(dict(fromId=root['id'],to=d['id'],originPoint=[root['lng'],root['lat']],targetPoint=[d['lng'],d['lat']],coordinates=route['geometry']['coordinates'],distance=route['distance'],snappedMeters=[w['distance'] for w in obj.get('waypoints',[])]))
    except Exception as e:
        failed.append(d['id']);print(f"Road route unavailable for {d['id']}: {type(e).__name__}")
    time.sleep(1)
result=dict(version=1,rootId=root['id'],feeder='SZA01',source='OSRM driving / OpenStreetMap',routes=routes,failed=failed)
out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,ensure_ascii=False))
print(f'Cached {len(routes)} road routes; {len(failed)} unavailable. These are driving routes, not electrical lines.')
