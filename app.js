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
$('dataset').innerHTML=window.PATROL_DATASETS.map(d=>'<option value="'+d.id+'">'+esc(d.label)+'</option>').join('');
$('dataset').value='TT69000423';
$('dataset').onchange=()=>{activeDataset=window.PATROL_DATASETS.find(d=>d.id===$('dataset').value);refreshDataset();};
$('selectedDevice').onchange=()=>select($('selectedDevice').value);
$('fit').onclick=fit;
$('togglePanel').onclick=()=>{const collapsed=document.body.classList.toggle('panel-collapsed');$('togglePanel').setAttribute('aria-expanded',String(!collapsed));requestAnimationFrame(()=>map.invalidateSize());};
map.on('mousemove',e=>{$('coordinates').textContent=`WGS 84 · ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;});


activeDataset=window.PATROL_DATASETS.find(d=>d.id===$('dataset').value);refreshDataset();

