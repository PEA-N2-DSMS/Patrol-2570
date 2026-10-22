'use strict';
const $ = id => document.getElementById(id);
let activeDataset = window.PATROL_DATASETS[0];
let survey = activeDataset.data;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map = L.map('map', { maxZoom:18 }).setView([16.1,99.8],12);
const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:18,maxNativeZoom:17,attribution:'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community'}).addTo(map);
tiles.on('tileerror',()=>{$('maperror').hidden=false;$('maperror').textContent='ภาพดาวเทียมโหลดไม่ได้ · แนวสำรวจยังแสดงได้';});
tiles.on('tileload',()=>{$('maperror').hidden=true;});
L.control.scale({imperial:false}).addTo(map);
const layers = new Map();
const normal = {color:'#ffe04a',weight:4,opacity:.85};
let geo;
function buildLayer() { layers.clear(); return L.geoJSON(survey,{style:normal,onEachFeature:(feature,layer)=>{
  const p=feature.properties;layers.set(p.name,layer);
  layer.bindTooltip(`${esc(p.name)}${activeDataset.treeSurvey ? ` · ${p.trees ?? 'ไม่ระบุ'} ต้น` : ''}`);
  layer.bindPopup(`<strong>ช่วง ${esc(p.name)}</strong><div style="white-space:pre-wrap;line-height:1.7">${esc(p.description)}</div>`);
  layer.on('click',()=>select(p.name,false));
}}).addTo(map); }
geo = buildLayer();
function fit(){map.fitBounds(geo.getBounds(),{padding:[35,35],maxZoom:16});}
function select(name,zoom=true){
  const f=survey.features.find(x=>x.properties.name===name);if(!f)return;
  for(const [id,layer] of layers)layer.setStyle(id===name?{color:'#39e6cd',weight:8,opacity:1}:normal);
  const layer=layers.get(name);layer.bringToFront();
  $('selectedDevice').value=name;$('selectedName').textContent=activeDataset.treeSurvey ? `ช่วงสำรวจ ${name}` : name;
  $('selectedPlace').textContent=f.properties.description;
  $('selectedTrees').textContent=f.properties.trees ?? '—';
  if(zoom){map.fitBounds(layer.getBounds(),{padding:[60,60],maxZoom:17});layer.openPopup();}
}

function refreshDataset() {
  leaveOverview();
  survey=activeDataset.data;
  if(geo) map.removeLayer(geo);
  geo=buildLayer();
  const suffix=f=>activeDataset.treeSurvey ? ' · '+(f.properties.trees ?? '—')+' ต้น' : '';
  $('selectedDevice').innerHTML=survey.features.map(f=>'<option value="'+esc(f.properties.name)+'">'+esc(f.properties.name)+suffix(f)+'</option>').join('');
  $('deviceCount').textContent=survey.features.length;
  $('treeCount').textContent=activeDataset.treeSurvey ? survey.features.reduce((n,f)=>n+(f.properties.trees||0),0) : '—';
  $('treeMetric').hidden=!activeDataset.treeSurvey;
  $('selectedTreeScope').hidden=!activeDataset.treeSurvey;
  $('devices').replaceChildren();
  for(const f of survey.features){const b=document.createElement('button');b.className='device';b.textContent=f.properties.name+suffix(f);b.onclick=()=>select(f.properties.name);$('devices').append(b);}
  $('jobTitle').textContent=activeDataset.id;
  $('mapJob').textContent=activeDataset.label;
  $('jobSubtitle').textContent=activeDataset.treeSurvey ? 'สำรวจจัดทำแผนตัดต้นไม้' : 'งาน Patrol · สายป้อน PLA01';
  $('mapSummary').textContent=activeDataset.treeSurvey ? `แนวสำรวจ ${survey.features.length} ช่วง · ต้นไม้ตามแผน ${survey.features.reduce((n,f)=>n+(f.properties.trees||0),0).toLocaleString('th-TH')} ต้น` : '22.35 กม. ตามไฟล์ · ดำเนินงานเสร็จสิ้น';
  $('sourceFile').textContent='แหล่งข้อมูล: '+activeDataset.id+'.kmz';
  document.title='PATROL MAP · '+activeDataset.id;
  select(survey.features[0].properties.name,false);fit();
}
const areas = [
  ['พิษณุโลก',16.8211,100.2659],['พิจิตร',16.4418,100.3488],
  ['ตะพานหิน',16.2200,100.4190],['สุโขทัย',17.0078,99.8264],
  ['สวรรคโลก',17.3159,99.8310],['อุตรดิตถ์',17.6201,100.0993],
  ['ตาก',16.8839,99.1258],['แม่สอด',16.7130,98.5740],
  ['กำแพงเพชร',16.4828,99.5227],['ขาณุวรลักษบุรี',16.0610,99.8600],
  ['น่าน',18.7756,100.7730],['แพร่',18.1446,100.1403]
];
let overviewMode = false;
const areaLayers = L.layerGroup();
const circuitLayers = L.layerGroup();
const palette = ['#ffe04a','#39e6cd','#ff88c8','#82b5ff','#ffad66','#c5a3ff'];
window.PATROL_DATASETS.forEach((dataset,index)=>{
  const color=palette[index%palette.length];
  const layer=L.geoJSON(dataset.data,{style:{color,weight:3,opacity:.8},onEachFeature:(feature,line)=>{
    line.bindTooltip(esc(dataset.id)+' · '+esc(feature.properties.name));
    line.on('click',()=>openDataset(dataset.id,feature.properties.name));
  }});
  circuitLayers.addLayer(layer);
  const button=document.createElement('button');button.className='device';
  button.textContent=dataset.label+' · '+dataset.data.features.length+' ช่วง';
  button.style.borderLeftColor=color;button.onclick=()=>openDataset(dataset.id);
  $('planList').append(button);
});
areas.forEach(([name,lat,lng],index)=>{
  const marker=L.marker([lat,lng],{icon:L.divIcon({className:'area-marker',html:'<span>'+(index+1)+'</span><b>'+esc(name)+'</b>',iconSize:[110,32],iconAnchor:[16,16]})});
  marker.bindPopup('<strong>'+esc(name)+'</strong><br>ตำแหน่งพื้นที่โดยประมาณ');
  areaLayers.addLayer(marker);
  const button=document.createElement('button');button.textContent=(index+1)+'. '+name;
  button.onclick=()=>{showOverview(true);map.setView([lat,lng],10);marker.openPopup();};
  $('areaList').append(button);
});
$('overviewCount').textContent=window.PATROL_DATASETS.length;
function openDataset(id,name){
  activeDataset=window.PATROL_DATASETS.find(d=>d.id===id);$('dataset').value=id;
  refreshDataset();if(name)select(name);
}
function leaveOverview(){
  overviewMode=false;map.removeLayer(areaLayers);map.removeLayer(circuitLayers);
  $('overviewSummary').hidden=true;$('datasetSummary').hidden=false;
  $('overview').setAttribute('aria-pressed','false');$('circuits').setAttribute('aria-pressed','false');
}
function fitOverview(){
  const bounds=L.latLngBounds([]);
  circuitLayers.eachLayer(layer=>bounds.extend(layer.getBounds()));
  if(map.hasLayer(areaLayers))areas.forEach(([,lat,lng])=>bounds.extend([lat,lng]));
  map.fitBounds(bounds,{paddingTopLeft:[40,100],paddingBottomRight:[110,100],maxZoom:12});
}
function showOverview(withAreas){
  overviewMode=true;if(geo)map.removeLayer(geo);
  circuitLayers.addTo(map);if(withAreas)areaLayers.addTo(map);else map.removeLayer(areaLayers);
  $('overviewSummary').hidden=false;$('datasetSummary').hidden=true;
  $('overview').setAttribute('aria-pressed',String(withAreas));$('circuits').setAttribute('aria-pressed',String(!withAreas));
  $('jobTitle').textContent=withAreas?'ภาพรวม 12 พื้นที่':'ภาพรวมวงจร';
  $('jobSubtitle').textContent='ภาพรวมงานสำรวจ';
  $('mapJob').textContent=withAreas?'จุดรวมงาน 12 พื้นที่':'แนวงาน / วงจรทั้งหมด';
  $('mapSummary').textContent=window.PATROL_DATASETS.length+' ชุดงาน · เลือกแนวบนแผนที่หรือรายการเพื่อดูรายละเอียด';
  $('sourceFile').textContent='แหล่งข้อมูล: KMZ ทั้งหมด';
  document.title='PATROL MAP · '+$('jobTitle').textContent;
  if(matchMedia('(max-width:650px)').matches){document.body.classList.add('panel-collapsed');$('togglePanel').setAttribute('aria-expanded','false');}
  map.invalidateSize();fitOverview();
}
$('overview').onclick=()=>showOverview(true);
$('circuits').onclick=()=>showOverview(false);
$('dataset').innerHTML=window.PATROL_DATASETS.map(d=>'<option value="'+d.id+'">'+esc(d.label)+'</option>').join('');
$('dataset').value='TT69000423';
$('dataset').onchange=()=>{activeDataset=window.PATROL_DATASETS.find(d=>d.id===$('dataset').value);refreshDataset();
showOverview(true);};
$('selectedDevice').onchange=()=>select($('selectedDevice').value);
$('fit').onclick=()=>overviewMode ? fitOverview() : fit();
$('togglePanel').onclick=()=>{const collapsed=document.body.classList.toggle('panel-collapsed');$('togglePanel').setAttribute('aria-expanded',String(!collapsed));requestAnimationFrame(()=>map.invalidateSize());};
map.on('mousemove',e=>{$('coordinates').textContent=`WGS 84 · ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;});


activeDataset=window.PATROL_DATASETS.find(d=>d.id===$('dataset').value);refreshDataset();
showOverview(true);

