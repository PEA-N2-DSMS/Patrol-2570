# PATROL · ขาณุวรลักษบุรี
ต้นแบบแผนที่อุปกรณ์ 22 kV จาก PEA exports 21 ตุลาคม 2569 รวม 386 จุดหลังรวม TAG ซ้ำและเพิ่ม CB จากไฟล์ 09:44

## เริ่มใช้งาน
ใช้ checkout ปัจจุบัน ไม่ต้องสร้าง worktree หรือ install package:

```sh
cd /workspace/Patrol-2570
python3 -m http.server 8000 --bind 0.0.0.0
```
เปิด index.html ผ่าน static web server หรือเปิดไฟล์โดยตรงได้ สามารถนำทั้งโฟลเดอร์ไปให้บริการด้วย static hosting ได้ โดยยังไม่มีระบบบัญชีผู้ใช้หรือฐานข้อมูลกลาง

- Leaflet 1.9.4 เก็บใน vendor (BSD-2-Clause, copyright อยู่ใน leaflet.js); แผนที่พื้นหลังใช้ OpenStreetMap ตาม attribution บนแผนที่
- แผนที่พื้นหลังต้องเข้าถึง tile.openstreetmap.org และการคำนวณถนนต้องเข้าถึง router.project-osrm.org ผ่าน HTTPS บริการสาธารณะไม่รับประกันความพร้อมใช้งาน การกดคำนวณจะส่งพิกัดที่เลือกไป OSRM; ใช้บริการภายใน/เชิงพาณิชย์สำหรับงานจริงตามนโยบายหน่วยงาน
- เลือก Feeder ตามรหัสสายป้อนที่ 1; สายป้อนที่ 2 แสดงใน popup ไม่ถูกนำไปนับซ้ำ
- ยอดรวมแยกตามทะเบียน Feeder ไม่ใช้การเรียงจุดใกล้กันเพื่อสมมติวงจรไฟฟ้า
- ระยะเส้นทางรถยนต์อาจอ้อม ไม่ใช่แนวสาย และไม่ใช้เป็นหลักฐานสอบทวนระบบป้องกันโดยลำพัง; เส้นตรงแสดงแยกชัดเจนเมื่อ routing ล้มเหลว
- ชนิดสายยังไม่ทราบ ไม่อนุมานจากฉนวนของอุปกรณ์ ผู้ใช้บันทึกชนิดสายแต่ละช่วงได้
- บันทึกเก็บใน localStorage ของเบราว์เซอร์ปัจจุบัน ส่งออก/นำเข้า JSON เพื่อสำรอง ไม่มีการ sync ข้ามเครื่อง

## นำเข้าข้อมูลใหม่
ข้อมูลเริ่มต้นเป็นชุดล่าสุด SZA01: 10 จุด (CB 1, SF6 2, Fuse 6, Disconnecting 1); เลือกทุกไฟล์เพื่อดูข้อมูลรวม ชุดล่าสุดมี switch 9 จุด ส่วนไฟล์แรกมี SZA01 11 จุด จึงเก็บข้อมูลที่พบเฉพาะในไฟล์เดิมไว้ในโหมดรวม โดยไม่อ้างว่าข้อมูลสอง snapshot มีขอบเขตเท่ากัน

มีทะเบียน MV 152 ช่วง รวม 12.159583 กม. โดยสมมติหน่วยคอลัมน์ระยะเป็นเมตร ต้องยืนยันหน่วยต้นทาง สาย SAC 100 ช่วง, PIC 30, Bare Aluminium 15, ACSR 6, XLPE 1 (จำแนกด้วยวัสดุและ label ของสาย ไม่ใช่ฉนวนอุปกรณ์) ตารางยังไม่มี geometry จึงผูกชนิดสายกับคู่จุดบนแผนที่ไม่ได้

ต้องมี Python openpyxl สำหรับแปลง Excel (ตัวเว็บไม่ต้องใช้):

```sh
python3 scripts/import_excel.py /path/to/switch.xlsx /path/to/recloser.xlsx
```
ตัวแปลงเลือกเฉพาะฟิลด์สำหรับแผนที่ ไม่คัดลอกรหัสผู้สร้าง/ผู้แก้ไข ตรวจ TAG ซ้ำและพิกัดก่อนสร้าง data.js

## ข้อมูลที่ต้องเพิ่มเพื่อไล่วงจรจริง
มีตำแหน่ง CB SZA01VB-01 แล้ว; ยังต้องการแนวสาย/เสาและการเชื่อมต่อพร้อม Feeder (KML/GeoJSON/GIS), ชนิดสายแต่ละช่วง, จุดปลายสาย, สถานะจุดเปิดปกติ และเหตุการณ์อุปกรณ์ทำงาน/วันตัดต้นไม้ ลำดับและระยะตามสายจริงต้องอ้างข้อมูลเชื่อมต่อเหล่านี้

## ตรวจสอบ
`node --check app.js` และ `python3 scripts/smoke_test.py` (ใช้ Playwright ที่ติดตั้งใน environment) ทดสอบตัวกรอง อุปกรณ์จริง การคำนวณ/บันทึกโดยจำลองคำตอบ OSRM, ความล้มเหลว routing และการนำเข้าบันทึก เนื่องจาก managed network ยังไม่เปิดโดเมน OSM/OSRM การทดสอบจำลองไม่ใช่หลักฐานว่าเส้นทางจริงตรงกับแนวสาย

ทดสอบด้วย Chromium ระบบ /usr/bin/chromium; หากเครื่องอื่นต้องติดตั้ง Chromium/Playwright ให้พร้อมก่อนรัน smoke test

## GitHub Pages
Push to `main` triggers `.github/workflows/pages.yml`. In repository Settings → Pages, choose **GitHub Actions** as the source. The workflow publishes only index.html, style.css, app.js, data.js, and vendor; uploaded source Excel files are not included. The published dashboard includes equipment coordinates from the supplied exports. Field notes stay in the user's browser.
