"""Import PEA exports. Usage: python scripts/import_excel.py <xlsx> ..."""
import json, sys
from pathlib import Path
import openpyxl
items=[]
conductors=[]
latest="PEA_20261021_094417.xlsx"
for name in sys.argv[1:]:
    w=openpyxl.load_workbook(name,read_only=True,data_only=True)
    for s in w:
        if s.title not in ('DS_Switch','DS_Recloser','DS_CircuitBreaker','DS_MVConductor'): continue
        rows=s.iter_rows(values_only=True)
        headers=[str(x).strip() for x in next(rows)]
        for row in rows:
            r=dict(zip(headers,row))
            if not r.get('รหัส TAG'): continue
            if s.title=='DS_MVConductor':
                conductors.append(dict(id=r.get('รหัส TAG'),feeder=r.get('รหัสสายป้อนที่ 1'),material=r.get('วัสดุที่ใช้ทำสาย'),size=r.get('ขนาดของสาย'),role=r.get('เป็น Main หรือ Lateral'),length=r.get('ระยะความยาวที่วัดได้ตามจริง'),shapeLength=r.get('SHAPE.LEN'),label=r.get('ข้อความกำกับสัญลักษณ์'),source=Path(name).name,snapshot=Path(name).name==latest))
                continue
            kind='Circuit Breaker' if s.title=='DS_CircuitBreaker' else r.get('ประเภทย่อยของสวิทช์','Recloser')
            category='CB' if kind=='Circuit Breaker' else 'Recloser' if kind=='Recloser' else 'SF6' if 'SF6' in kind else 'Fuse' if 'Fuse' in kind else 'อื่น ๆ'
            lat,lng=r.get('LATITUDE'),r.get('LONGITUDE')
            valid=isinstance(lat,(float,int)) and isinstance(lng,(float,int)) and -90<=lat<=90 and -180<=lng<=180 and (lat,lng)!=(0,0)
            items.append(dict(id=str(r['รหัส TAG']),name=r.get('รหัสอุปกรณ์') or r['รหัส TAG'],category=category,kind=kind,feeder=r.get('รหัสสายป้อนที่ 1') or 'ไม่ระบุ',feeder2=r.get('รหัสสายป้อนที่ 2') or '',place=r.get('สถานที่') or '',status=r.get('สถานะปัจจุบัน') or '',voltage=r.get('ระดับแรงดัน') or '',lat=lat if valid else None,lng=lng if valid else None,source=Path(name).name,snapshot=Path(name).name==latest))
merged={}
for item in items:
    old=merged.get(item['id'])
    if not old or item['snapshot']:
        merged[item['id']]=item
items=list(merged.values())
Path(__file__).resolve().parents[1].joinpath('data.js').write_text('window.PEA_DATA = '+json.dumps(items,ensure_ascii=False)+';\nwindow.PEA_CONDUCTORS = '+json.dumps(conductors,ensure_ascii=False)+';\n')
print(f'{len(items)} devices; {sum(x["lat"] is None for x in items)} missing coordinates')
