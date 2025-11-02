// script.js (fixed)
// - ใช้ Esri/OSM เป็นค่าเริ่มต้น (ไม่พึ่ง Google tile)
// - HLS เสถียรขึ้น, อัปเดตลิงก์ Open RAW อัตโนมัติ

(() => {
  'use strict';

  const bootstrapCams = [
    {name: "SC-014 TVA-60 จุดกลับรถเขาตาโล", url: "https://stream2.ioc.pattaya.go.th/live/SC-014.m3u8?hls_ctx=aq1o4098", lat: 12.91006, lng: 100.8959148},
    {name: "SC-015 TVA-61 จุดกลับรถเขาตาโล", url: "https://stream2.ioc.pattaya.go.th/live/SC-015.m3u8?hls_ctx=301iuj73", lat: 12.9100652, lng: 100.8959155},
    {name: "SC-016 ATC-1 แยกสุขุมวิท-เขาตาโล", url: "https://stream2.ioc.pattaya.go.th/live/RC-590.m3u8?hls_ctx=3e056imt", lat: 12.910069, lng: 100.895912},
    {name: "SC-195 TVA-97 แยกชัยพฤกษ์ 2 เลียบทางรถไฟ", url: "https://stream1.ioc.pattaya.go.th/live/SC-195.m3u8?hls_ctx=i2745z37", lat: 12.88222, lng: 100.904293},
    {name: "SC-008 TVA-89 แยกเขาตาโลเลียบทางรถไฟ", url: "https://stream2.ioc.pattaya.go.th/live/SC-008.m3u8?hls_ctx=92csjp78", lat: 12.9091033, lng: 100.9012205},
    {name: "RC-619 TVS-42 ปากซอยวัดบุณย์กัญจนาราม", url: "https://stream2.ioc.pattaya.go.th/live/RC-619.m3u8?hls_ctx=o4t9lm36", lat: 12.8895075, lng: 100.8973051},
    {name: "SC-020 TVN-269 ถนนพัทยาใต้ ซ. 22",url: "https://stream2.ioc.pattaya.go.th/live/SC-020.m3u8?hls_ctx=45r1463a",lat: 12.92395189,lng: 100.87934769},
    {name: "SC-021 TVN-270 ถนนพัทยาใต้ ซ. 22", url: "https://stream2.ioc.pattaya.go.th/live/SC-021.m3u8?hls_ctx=4gyi763i", lat: 12.92395189, lng: 100.87934769},
    {name: "TVA - 088 แยกซอยวัดธรรมเลียบทางรถไฟ", url: "https://stream2.ioc.pattaya.go.th/live/SC-002-5275.ts?hls_ctx=63b004r7", lat: 12.87808, lng: 100.906047},
    {name: "CC-002 TVA-18 จุดกลับรถโชคดีค้าไม้", url: "https://stream1.ioc.pattaya.go.th/live/CC-002.m3u8?hls_ctx=69rkl7s3", lat: 12.946846, lng: 100.905277},
    {name: "NC-351 ATC-14 14-แยกปริญญา", url: "https://stream1.ioc.pattaya.go.th/live/NC-351.m3u8?hls_ctx=u2496253", lat: 12.949934, lng: 100.897356}
  ];

  // ---------- State / Refs ----------
  let cameras = [...bootstrapCams];
  let current = -1;
  let hls = null;

  const video          = document.getElementById('videoPlayer');
  const locationLabel  = document.getElementById('locationLabel');
  const cameraItemsBox = document.getElementById('cameraItems');

  // ---------- Map ----------
  let map, miniMap, markers = [], currentBasemap;

  const cameraIcon = L.icon({
    iconUrl: "https://i.postimg.cc/6p2dcG1b/image.png",
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
  });

  // providers แบบ "ไม่ต้องใช้คีย์"
  function esriImagery() {
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri, Maxar, Earthstar Geographics', maxZoom: 19 }
    );
  }
  function esriTopo() {
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri', maxZoom: 19 }
    );
  }
  function osm() {
    return L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '&copy; OpenStreetMap', maxZoom: 19 }
    );
  }
  function cartoDark() {
    return L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19, attribution: '&copy; CARTO & OSM' }
    );
  }

  function initMaps() {
    // main map
    map = L.map('map').setView([12.9276, 100.8766], 12);
    currentBasemap = esriImagery().addTo(map);

    // mini map
    miniMap = L.map('miniMap', { zoomControl: false }).setView([12.95, 100.89], 9);
    osm().addTo(miniMap);

    map.on('move', () => miniMap.setView(map.getCenter(), Math.max(map.getZoom() - 4, 1)));

    updateMarkers();
    updateList();
  }

  function updateMarkers() {
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    cameras.forEach((cam, i) => {
      const m = L.marker([cam.lat, cam.lng], { icon: cameraIcon })
        .addTo(map)
        .bindPopup(`<b>${cam.name}</b><br>${cam.lat.toFixed(6)}, ${cam.lng.toFixed(6)}`);
      m.on('click', () => selectCamera(i));
      markers.push(m);
    });
  }

  function updateList() {
    cameraItemsBox.innerHTML = '';
    cameras.forEach((cam, i) => {
      const el = document.createElement('div');
      el.className = `camera-item ${current === i ? 'active' : ''}`;
      el.innerHTML = `
        <div class="camera-name">${cam.name}</div>
        <div class="camera-coords">${cam.lat.toFixed(6)}, ${cam.lng.toFixed(6)}</div>
        <div class="camera-actions">
          <button class="btn" data-play="${i}">▶ เล่น</button>
          <button class="btn" data-view="${i}">ไปที่จุด</button>
        </div>`;
      cameraItemsBox.appendChild(el);
    });

    cameraItemsBox.querySelectorAll('[data-play]').forEach(b => {
      b.onclick = () => selectCamera(+b.dataset.play);
    });
    cameraItemsBox.querySelectorAll('[data-view]').forEach(b => {
      b.onclick = () => {
        const cam = cameras[+b.dataset.view];
        map.setView([cam.lat, cam.lng], 16);
      };
    });
  }

  // ---------- Video / HLS ----------
  function playVideo(url) {
    try {
      video.crossOrigin = 'anonymous';
      video.setAttribute('crossorigin', 'anonymous');
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
    } catch {}

    // เคลียร์ของเก่า
    if (hls) { try { hls.destroy(); } catch {} hls = null; }
    try { video.pause(); } catch {}
    video.removeAttribute('src');

    // อัปเดตลิงก์ RAW
    setRawLink(url);

    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        xhrSetup: xhr => { xhr.withCredentials = false; }
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(()=>{ /* autoplay policy */ });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.warn('HLS error', data);
        if (data?.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
            case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
            default: try { hls.destroy(); } catch {}
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => video.play().catch(()=>{}), { once: true });
    } else {
      console.warn('HLS not supported in this browser');
    }
  }

  function selectCamera(idx) {
    current = idx;
    const cam = cameras[idx];
    playVideo(cam.url);
    map.setView([cam.lat, cam.lng], 15);
    if (locationLabel) locationLabel.textContent = cam.name;
    updateList();
  }

  // ---------- Search ----------
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', e => {
    const q = (e.target.value || '').toLowerCase();
    [...cameraItemsBox.children].forEach((node, i) => {
      const name = cameras[i].name.toLowerCase();
      node.style.display = name.includes(q) ? 'block' : 'none';
    });
  });

  // ---------- Global functions (เรียกจาก index.html) ----------
  window.zoomOut = function () {
    map?.setView([12.911734532969971, 100.89087891080237], 12);
  };
//---------เปลี่ยน Basemap-----//
  window.changeBasemap = function () {
    const sel = document.getElementById('basemapSelect');
    if (!sel || !map) return;
    if (currentBasemap) map.removeLayer(currentBasemap);

    const type = sel.value;
    const layers = {
      satellite: esriImagery(),
      street   : osm(),
      terrain  : esriTopo(),
      dark     : cartoDark()
    };
    currentBasemap = layers[type] || layers.satellite;
    currentBasemap.addTo(map);
  };
    
   const basemapSelect = document.getElementById('basemapSelect');
	if (basemapSelect) {
  	basemapSelect.addEventListener('change', window.changeBasemap);
	}
//-------แสดงขอบเขต---------//
// ฟังก์ชันสุ่มสี
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

let geoLayer = null; // เก็บเลเยอร์ polygon

// โหลด GeoJSON
function loadGeoJSON() {
  fetch('data/pattayaPoly.geojson')
    .then(res => res.json())
    .then(data => {
      geoLayer = L.geoJSON(data, {
        style: feature => ({
          color: 'white',         // สีขอบ
          weight: 1,              // ความหนาขอบ
          fillColor: getRandomColor(), // สีสุ่ม
          fillOpacity: 0.3
        }),
        onEachFeature: (feature, layer) => {
          // กดแล้วขึ้น popup
          const name = feature.properties.Name || "ไม่มีชื่อ";
          layer.bindPopup(`<b>${name}</b>`);
        }
      }).addTo(map);
    })
    .catch(err => console.error("❌ โหลด GeoJSON ไม่ได้:", err));
}

// ฟังก์ชันสลับเปิด/ปิด ขอบเขตเมืองพัทยา
const toggleBtn = document.getElementById('toggleBtn');
let isShown = false;

toggleBtn?.addEventListener('click', () => {
  if (!isShown) {
    loadGeoJSON();
    toggleBtn.classList.add('active');
    toggleBtn.textContent = "ขอบเขตพัทยา";
  } else {
    if (geoLayer) {
      map.removeLayer(geoLayer);
      geoLayer = null;
    }
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = "ขอบเขตพัทยา";
  }
  isShown = !isShown;
});
    
//------ระบุตำแหน่งตัวเอง-------//
  let myMarker = null;
  let myOn = false;
  window.toggleMyLocation = function () {
    myOn = !myOn;
    const btn = document.getElementById('locateBtn');
    btn?.classList.toggle('active', myOn);
    if (!myOn) { if (myMarker) { map.removeLayer(myMarker); myMarker = null; } return; }

    if (!navigator.geolocation) {
      alert('เบราว์เซอร์ไม่รองรับการหาตำแหน่ง');
      myOn = false; btn?.classList.remove('active');
      return;
    }
    navigator.geolocation.getCurrentPosition(pos => {
      const icon = L.icon({ iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png", iconSize: [32, 32], iconAnchor: [16, 32] });
      if (myMarker) map.removeLayer(myMarker);
      myMarker = L.marker([pos.coords.latitude, pos.coords.longitude], { icon }).addTo(map).bindPopup('<strong>ตำแหน่งของคุณ</strong>');
      map.setView([pos.coords.latitude, pos.coords.longitude], 15);
    }, err => {
      alert('ไม่สามารถระบุตำแหน่งได้: ' + err.message);
      myOn = false; btn?.classList.remove('active');
    });
  };

  window.exportJSON = function () {
    const dataStr = JSON.stringify(cameras, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pattaya-cctv.json'; a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Boot ----------
  window.addEventListener('load', () => {
    initMaps();
    if (cameras.length > 0) selectCamera(0);
  });
})();

// ====== Controls under the player ======
const $video = document.getElementById('videoPlayer');
const $muteBtn = document.getElementById('muteBtn');
const $shotBtn = document.getElementById('screenshotBtn');
const $rawLink = document.getElementById('rawLink');

// Mute / Unmute
$muteBtn?.addEventListener('click', () => {
  if (!$video) return;
  $video.muted = !$video.muted;
  $muteBtn.textContent = $video.muted ? '🔇 Mute' : '🔊 Unmute';
});

// Screenshot (อาจติด CORS ถ้าสตรีมข้ามโดเมน)
$shotBtn?.addEventListener('click', () => {
  if (!$video || !$video.videoWidth) { alert('วิดีโอยังไม่พร้อม'); return; }
  try {
    const c = document.createElement('canvas');
    c.width = $video.videoWidth; c.height = $video.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage($video, 0, 0, c.width, c.height);
    c.toBlob(blob => {
      if (!blob) { alert('จับภาพไม่สำเร็จ'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch {
    alert('ไม่สามารถจับภาพจากสตรีมนี้ได้ (อาจติด CORS ของวิดีโอข้ามโดเมน).');
  }
});

// อัปเดตลิงก์ Open RAW ใต้จอ
function setRawLink(hlsUrl) {
  if (!$rawLink) return;
  if (hlsUrl) {
    $rawLink.href = hlsUrl;
    $rawLink.classList.remove('is-disabled');
  } else {
    $rawLink.removeAttribute('href');
    $rawLink.classList.add('is-disabled');
  }
}

// เปลี่ยนโหมดมุมมองรายการกล้อง
function setCamView(mode){
  const listPanel = document.getElementById('cameraList');
  const wrap = document.getElementById('cameraItems');
  listPanel.classList.remove('view-grid');
  wrap.classList.remove('compact');
  if(mode === 'grid') listPanel.classList.add('view-grid');
  else if(mode === 'compact') wrap.classList.add('compact');
  localStorage.setItem('camView', mode);
}
window.addEventListener('DOMContentLoaded', () => {
  setCamView(localStorage.getItem('camView') || 'grid');
});
