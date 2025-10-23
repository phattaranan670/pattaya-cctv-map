// Bootstrap Camera Data ข้อมูลกล้องวงจรปิด
const bootstrapCams = [
  {name: "SC-014 TVA-60 จุดกลับรถเขาตาโล",url: "https://stream2.ioc.pattaya.go.th/live/SC-014.m3u8?hls_ctx=aq1o4098",lat: 12.91006,lng: 100.8959148},
  {name: "SC-015 TVA-61 จุดกลับรถเขาตาโล",url: "https://stream2.ioc.pattaya.go.th/live/SC-015.m3u8?hls_ctx=301iuj73",lat: 12.9100652,lng: 100.8959155},
  {name: "SC-016 ATC-1 แยกสุขุมวิท-เขาตาโล",url: "https://stream2.ioc.pattaya.go.th/live/RC-590.m3u8?hls_ctx=3e056imt",lat: 12.910069,lng: 100.895912},
  {name: "SC-195 TVA-97 แยกชัยพฤกษ์ 2 เลียบทางรถไฟ",url: "https://stream1.ioc.pattaya.go.th/live/SC-195.m3u8?hls_ctx=i2745z37",lat: 12.88222,lng: 100.904293},
  {name: "SC-008 TVA-89 แยกเขาตาโลเลียบทางรถไฟ",url: "https://stream2.ioc.pattaya.go.th/live/SC-008.m3u8?hls_ctx=92csjp78",lat: 12.9091033,lng: 100.9012205},
  {name: "RC-619 TVS-42 ปากซอยวัดบุณย์กัญจนาราม",url: "https://stream2.ioc.pattaya.go.th/live/RC-619.m3u8?hls_ctx=o4t9lm36",lat: 12.8895075,lng: 100.8973051},
  {name: "SC-021 TVN-270 ถนนพัทยาใต้ ซ. 22",url: "https://stream2.ioc.pattaya.go.th/live/SC-021.m3u8?hls_ctx=4gyi763i",lat: 12.92395189,lng: 100.87934769},
  {name: "SC-020 TVN-269 ถนนพัทยาใต้ ซ. 22",url: "https://stream2.ioc.pattaya.go.th/live/SC-020.m3u8?hls_ctx=45r1463a",lat: 12.92395189,lng: 100.87934769},
  {name: "TVA - 088 แยกซอยวัดธรรมเลียบทางรถไฟ",url:"https://stream2.ioc.pattaya.go.th/live/SC-002-5275.ts?hls_ctx=63b004r7",lat:12.87808 ,lng:100.906047 },
  {name: "CC-002 TVA-18 จุดกลับรถโชคดีค้าไม้",url:"https://stream1.ioc.pattaya.go.th/live/CC-002.m3u8?hls_ctx=69rkl7s3",lat: 12.946846,lng: 100.905277},
  {name: "NC-351 ATC-14 14-แยกปริญญา",url:"https://stream1.ioc.pattaya.go.th/live/NC-351.m3u8?hls_ctx=u2496253",lat: 12.949934,lng: 100.897356}
];
// Global Variables
let map,miniMap,markers = [],cameras = [...bootstrapCams],currentCamera = null;
let showMarkers = true,showMyLocation = false,myLocationMarker = null,hls = null,currentBasemap = null;

// Camera Icon
const cameraIcon = L.icon({
  iconUrl: "https://i.postimg.cc/6p2dcG1b/image.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

// Initialize Maps
function initMaps() {
  // Main Map
  map = L.map("map").setView([12.9276, 100.8766], 12);
  currentBasemap = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      maxZoom: 20,
      minZoom: 8,
     subdomains: ["mt0", "mt1", "mt2", "mt3"] 
    }
  ).addTo(map);

  // Mini Map
  miniMap = L.map("miniMap", {
    zoomControl: false
  }).setView([12.95, 100.89], 9);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20
  }).addTo(miniMap);

  // Sync mini map with main map
  map.on("move", () =>
    miniMap.setView(map.getCenter(), Math.max(map.getZoom() - 4, 1))
  );

  // Initialize markers and camera list
  updateMarkers();
  updateCameraList();
}

// Update Markers
function updateMarkers() {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];
  if (showMarkers) {
    cameras.forEach((cam, i) => {
      const m = L.marker([cam.lat, cam.lng], { icon: cameraIcon })
        .addTo(map)
        .bindPopup(
          `<b>${cam.name}</b><br>${cam.lat.toFixed(6)}, ${cam.lng.toFixed(6)}`
        );
      m.on("click", () => selectCamera(i));
      markers.push(m);
    });
  }
}

// Update Camera list รายการกล้อง
function updateCameraList() {
  const container = document.getElementById("cameraItems");
  container.innerHTML = "";
  cameras.forEach((cam, i) => {
    const div = document.createElement("div");
    div.className = `camera-item ${currentCamera === i ? "active" : ""}`;
    div.innerHTML = `
            <div class="camera-name">${cam.name}</div>
            <div class="camera-coords">${cam.lat.toFixed(6)}, ${cam.lng.toFixed(
      6
    )}</div>
            <div class="camera-actions">
                <button onclick="selectCamera(${i})">▶ เล่น</button>
                <button onclick="viewCamera(${i})">ไปที่จุด</button>
            </div>
        `;
    container.appendChild(div);
  });
}

// Select Camera
function selectCamera(i) {
  currentCamera = i;
  const cam = cameras[i];
  playVideo(cam.url);
  map.setView([cam.lat, cam.lng], 15);
  document.getElementById("locationLabel").textContent = cam.name;
  updateCameraList();
}

// Play Video
function playVideo(url) {
  const video = document.getElementById("videoPlayer");
  if (hls) hls.destroy();
  if (Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    video.addEventListener("loadedmetadata", () => video.play());
  }
}

// View Camera
function viewCamera(i) {
  const cam = cameras[i];
  map.setView([cam.lat, cam.lng], 16);
}

// Zoom Out มาที่เมืองพัทยารวม
function zoomOut() {
  map.setView([12.926604381817643, 100.88752975588214], 12);
}

// Toggle My Location
function toggleMyLocation() {
  showMyLocation = !showMyLocation;
  const btn = document.getElementById("locateBtn");
  btn.classList.toggle("active", showMyLocation);

  if (showMyLocation) {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (myLocationMarker) map.removeLayer(myLocationMarker);
          const icon = L.icon({
            iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
            iconSize: [32, 32],
            iconAnchor: [16, 32]
          });
          myLocationMarker = L.marker(
            [pos.coords.latitude, pos.coords.longitude],
            { icon }
          ).addTo(map);
          myLocationMarker.bindPopup("<strong>ตำแหน่งของคุณ</strong>");
          map.setView([pos.coords.latitude, pos.coords.longitude], 15);
        },
        (err) => {
          alert("ไม่สามารถระบุตำแหน่งได้: " + err.message);
          showMyLocation = false;
          btn.classList.remove("active");
        }
      );
    } else {
      alert("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง");
      showMyLocation = false;
      btn.classList.remove("active");
    }
  } else {
    if (myLocationMarker) {
      map.removeLayer(myLocationMarker);
      myLocationMarker = null;
    }
  }
}

// Change Basemap
function changeBasemap() {
  const type = document.getElementById("basemapSelect").value;
  if (currentBasemap) map.removeLayer(currentBasemap);

  const layers = {
    satellite: L.tileLayer(
      "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
      {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
      }
    ),
    street: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20
    }),
    terrain: L.tileLayer("https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}", {
      maxZoom: 20,
      subdomains: ["mt0", "mt1", "mt2", "mt3"]
    }),
    dark: L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        subdomains: "abcd"
      }
    )
  };

  currentBasemap = layers[type];
  currentBasemap.addTo(map);
}

// Import JSON
function importJSON() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        cameras = JSON.parse(event.target.result);
        updateMarkers();
        updateCameraList();
        alert("นำเข้าข้อมูลสำเร็จ");
      } catch (error) {
        alert("ไฟล์ JSON ไม่ถูกต้อง");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// Export JSON
function exportJSON() {
  const dataStr = JSON.stringify(cameras, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pattaya-cctv.json";
  link.click();
}

// Search
document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const items = document.querySelectorAll(".camera-item");

  items.forEach((item, index) => {
    const name = cameras[index].name.toLowerCase();
    item.style.display = name.includes(query) ? "block" : "none";
  });
});

// Initialize on page load
window.onload = () => {
  initMaps();
  if (cameras.length > 0) {
    selectCamera(0);
  }
};

