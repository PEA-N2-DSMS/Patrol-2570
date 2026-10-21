'use strict';
const $ = id => document.getElementById(id);
const survey = window.PATROL_KMZ;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const map = L.map('map', { maxZoom:18 }).setView([16.1,99.8],12);
const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:18,maxNativeZoom:17,attribution:'Tiles © Esri — Esri, Maxar, Earthstar Geographics, GIS User Community'}).addTo(map);
tiles.on('tileerror',()=>{$('maperror').hidden=false;$('maperror').textContent='ภาพดาวเทียมโหลดไม่ได้ · แนวสำรวจยังแสดงได้';});
tiles.on('tileload',()=>{$('maperror').hidden=true;});
L.control.scale({imperial:false}).addTo(map);
const layers = new Map();
const normal = {color:'#ffe04a',weight:4,opacity:.85};
const geo = L.geoJSON(survey,{style:normal,onEachFeature:(feature,layer)=>{
  const p=feature.properties;layers.set(p.name,layer);
  layer.bindTooltip(`ช่วง ${esc(p.name)} · ${p.trees ?? 'ไม่ระบุ'} ต้น`);
  layer.bindPopup(`<strong>ช่วง ${esc(p.name)}</strong><div style="white-space:pre-wrap;line-height:1.7">${esc(p.description)}</div>`);
  layer.on('click',()=>select(p.name,false));
}}).addTo(map);
function fit(){map.fitBounds(geo.getBounds(),{padding:[35,35],maxZoom:16});}
function select(name,zoom=true){
  const f=survey.features.find(x=>x.properties.name===name);if(!f)return;
  for(const [id,layer] of layers)layer.setStyle(id===name?{color:'#39e6cd',weight:8,opacity:1}:normal);
  const layer=layers.get(name);layer.bringToFront();
  $('selectedDevice').value=name;$('selectedName').textContent=`ช่วงสำรวจ ${name}`;
  $('selectedPlace').textContent=f.properties.description;
  $('selectedTrees').textContent=f.properties.trees ?? '—';
  if(zoom){map.fitBounds(layer.getBounds(),{padding:[60,60],maxZoom:17});layer.openPopup();}
}
$('selectedDevice').innerHTML=survey.features.map(f=>`<option value="${esc(f.properties.name)}">ช่วง ${esc(f.properties.name)} · ${f.properties.trees ?? '—'} ต้น</option>`).join('');
$('selectedDevice').onchange=()=>select($('selectedDevice').value);
$('deviceCount').textContent=survey.features.length;
$('treeCount').textContent=survey.features.reduce((n,f)=>n+(f.properties.trees||0),0);
for(const f of survey.features){const b=document.createElement('button');b.className='device';b.textContent=`ช่วง ${f.properties.name} · ${f.properties.trees ?? '—'} ต้น`;b.onclick=()=>select(f.properties.name);$('devices').append(b);}
$('fit').onclick=fit;
$('togglePanel').onclick=()=>{const collapsed=document.body.classList.toggle('panel-collapsed');$('togglePanel').setAttribute('aria-expanded',String(!collapsed));requestAnimationFrame(()=>map.invalidateSize());};
map.on('mousemove',e=>{$('coordinates').textContent=`WGS 84 · ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;});
select(survey.features[0].properties.name,false);fit();
