// detection.js - Enhanced Multi-Engine Detection System
// Supports: Local (COCO-SSD/YOLO auto), YOLOv11 API, Roboflow API
// Integrated with Pattaya CCTV System

(() => {
  'use strict';

  /* ==================== CONFIGURATION ==================== */
  
  // YOLO Configuration
  const YOLO = {
    // ✅ Github API (กำลังใช้งาน)
    apiUrl: 'https://github.com/phattaranan670/pattaya-cctv-map/releases/download/v1/best.pt',
    imgSize: 640,
    minConfAccident: 0.55,
    minConfVehicle: 0.25,
    timeout: 10000  // 10 seconds timeout
  };

  // Roboflow Configuration (ถ้าต้องการใช้)
  const ROBOFLOW = {
    apiUrl: 'https://serverless.roboflow.com/detection-accident-yb0lz-g9hc9/1',  // ใส่ Roboflow API URL
    apiKey: 'evLVrAROGlWWdQOMUPaz',  // ใส่ Roboflow API Key
    confidence: 40,
    overlap: 30
  };

  // Detection Parameters
  const UPSCALE = 1.5;
  let intervalMs = 1000;

  // Accident Detection Rules
  const STRICT = {
    minFramesConfirm: 3,        // ต้องเห็นต่อเนื่องกี่เฟรม
    rfTrigger: 0.55,             // เกณฑ์เริ่มต้น
    rfRelease: 0.50,             // เกณฑ์คงสถานะ
    maxBoxAreaRatio: 0.45,
    minBoxAreaRatio: 0.002,
    minBoxWH: 24,
    requireCarsNear: 2,
    nearIou: 0.10,
    useROI: false,
    ROI: [[0.10,0.25], [0.90,0.25], [0.90,0.95], [0.10,0.95]]
  };

  // Vehicle Classes
  const VEHICLE_CLASSES = {
    car: ['car','cars','mobil','mobil_box','mobil_pickup','mobil_van'],
    bus: ['bus','mini_bus'],
    truck: ['truck'],
    motorcycle: ['motorcycle','motorbike','motobike','sepeda_motor'],
    bicycle: ['bicycle']
  };

  const ALL_VEHICLE_NAMES = Object.values(VEHICLE_CLASSES).flat().map(s=>s.toLowerCase());
  const isAccidentName = (n) => String(n||'').toLowerCase() === 'accident';
  const canonVehicle = (n) => {
    const c = String(n||'').toLowerCase();
    for (const k in VEHICLE_CLASSES) {
      if (VEHICLE_CLASSES[k].includes(c)) return k;
    }
    return c;
  };

  /* ==================== DOM ELEMENTS ==================== */
  
  const els = {
    toggleBtn: document.getElementById('detectionBtn'),
    startBtn: document.getElementById('detectStartBtn') || document.getElementById('detectionStartBtn'),
    stopBtn: document.getElementById('detectStopBtn') || document.getElementById('detectionStopBtn') || document.getElementById('stopBtn'),
    engineSel: document.getElementById('engineSelect'),
    intervalSel: document.getElementById('intervalSelect'),
    beepToggle: document.getElementById('beepToggle'),
    video: document.getElementById('videoPlayer'),
    canvas: document.getElementById('overlay'),
    camLabel: document.getElementById('locationLabel'),
    alertBanner: document.getElementById('alertBanner')
  };

  const ctx = els.canvas?.getContext('2d');

  /* ==================== STATE VARIABLES ==================== */
  
  let running = false;
  let busy = false;
  let nextTick = null;
  let activeRunId = 0;
  let coco = null;
  
  // Accident tracking
  let upW = 0, upH = 0;
  let accStreak = 0;
  let lastAccBox = null;
  let accidentActive = false;
  let lastAccidentTime = 0;
  const ACCIDENT_COOLDOWN = 5000; // 5 seconds

  // Engine mode
  let ENGINE = 'local'; // 'local', 'yolo', 'roboflow', 'both', 'off'

  /* ==================== UI BINDINGS ==================== */
  
  if (els.startBtn) els.startBtn.onclick = () => startDetection();
  if (els.stopBtn) els.stopBtn.onclick = () => stopDetection();
  if (els.toggleBtn) els.toggleBtn.onclick = () => running ? stopDetection() : startDetection();
  
  if (els.engineSel) {
    els.engineSel.onchange = e => {
      ENGINE = e.target.value;
      console.log('[Detection] Engine changed to:', ENGINE);
      if (ENGINE === 'off' && running) stopDetection();
    };
    ENGINE = els.engineSel.value || 'local';
  }

  if (els.intervalSel) {
    els.intervalSel.onchange = e => {
      const v = String(e.target.value || '').toLowerCase();
      const n = v.includes('s') ? parseFloat(v) * 1000 : parseInt(v, 10);
      intervalMs = isNaN(n) ? intervalMs : Math.max(80, n);
      console.log('[Detection] Interval set to:', intervalMs, 'ms');
    };
    intervalMs = parseInt(els.intervalSel.value || '1000', 10);
  }

  /* ==================== CANVAS SYNC ==================== */
  
  function syncCanvas() {
    if (!els.canvas || !els.video) return;
    const w = els.video.clientWidth || els.video.videoWidth || 0;
    const h = els.video.clientHeight || els.video.videoHeight || 0;
    if (!w || !h) return;
    if (els.canvas.width !== w || els.canvas.height !== h) {
      els.canvas.width = w;
      els.canvas.height = h;
    }
  }

  window.addEventListener('resize', syncCanvas);
  if (els.video) els.video.addEventListener('loadedmetadata', syncCanvas);

  /* ==================== START / STOP ==================== */
  
  async function startDetection() {
    if (running) return;
    if (ENGINE === 'off') {
      console.log('[Detection] Engine is OFF');
      return;
    }

    running = true;
    activeRunId++;
    accStreak = 0;
    lastAccBox = null;
    accidentActive = false;

    console.log('[Detection] Starting with engine:', ENGINE);

    // Load COCO-SSD if needed
    if ((ENGINE === 'local' || ENGINE === 'both') && !coco) {
      try {
        console.log('[Detection] Loading COCO-SSD...');
        if (window.tf?.setBackend) await tf.setBackend('webgl');
        coco = await cocoSsd.load({ base: 'mobilenet_v2' });
        console.log('[Detection] COCO-SSD loaded successfully');
      } catch (e) {
        console.warn('[Detection] Fallback to lite model', e);
        try {
          coco = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        } catch (e2) {
          console.error('[Detection] Failed to load COCO-SSD', e2);
          banner('โหลด COCO-SSD ไม่สำเร็จ');
          running = false;
          updateUI();
          return;
        }
      }
    }

    syncCanvas();
    scheduleNext(true);
    updateUI();
    banner('Detection เริ่มทำงาน...', 'info');
  }

  function stopDetection() {
    if (!running) return;
    
    console.log('[Detection] Stopping...');
    running = false;
    activeRunId++;
    
    if (nextTick) {
      clearTimeout(nextTick);
      nextTick = null;
    }

    accStreak = 0;
    lastAccBox = null;
    accidentActive = false;

    if (ctx) ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);

    window.dispatchEvent(new CustomEvent('accident:clear', { 
      detail: { at: Date.now() } 
    }));
    
    updateUI();
    banner('Detection หยุดทำงาน', 'info');
  }

  /* ==================== UI UPDATE ==================== */
  
  function updateUI() {
    if (els.startBtn) els.startBtn.disabled = running;
    if (els.stopBtn) els.stopBtn.disabled = !running;
    if (els.toggleBtn) {
      els.toggleBtn.classList.toggle('active', running);
      els.toggleBtn.textContent = running ? '🛑 หยุด' : '🚨 Detection';
    }
  }

  /* ==================== SCHEDULING ==================== */
  
  function scheduleNext(immediate = false) {
    if (!running) return;
    if (nextTick) {
      clearTimeout(nextTick);
      nextTick = null;
    }
    if (immediate) {
      requestAnimationFrame(loop);
    } else {
      nextTick = setTimeout(() => requestAnimationFrame(loop), intervalMs);
    }
  }

  function loop() {
    if (!running) return;
    if (busy) {
      scheduleNext(false);
      return;
    }
    busy = true;
    const myRun = activeRunId;
    detectOnce(myRun).finally(() => {
      busy = false;
      scheduleNext(false);
    });
  }

  /* ==================== MAIN DETECTION ==================== */
  
  async function detectOnce(myRun) {
    if (!running || myRun !== activeRunId) return;
    if (!els.video || els.video.readyState < 2) return;

    const srcW = els.video.videoWidth || els.canvas.width;
    const srcH = els.video.videoHeight || els.canvas.height;
    if (!srcW || !srcH) return;

    upW = Math.round(srcW * UPSCALE);
    upH = Math.round(srcH * UPSCALE);

    // Create upscaled frame
    const frame = document.createElement('canvas');
    frame.width = upW;
    frame.height = upH;
    const fctx = frame.getContext('2d');
    fctx.drawImage(els.video, 0, 0, upW, upH);

    try {
      let allDetections = [];
      let accidentDetections = [];

      // Run detection based on engine
      if (ENGINE === 'local') {
        const localPreds = await runCOCO(frame, upW, upH);
        allDetections = localPreds;
        // Check for accidents using overlap/density
        accidentDetections = detectAccidentsByRules(localPreds);
      } 
      else if (ENGINE === 'yolo') {
        const yoloResult = await callYOLO(frame);
        allDetections = [...yoloResult.vehicles, ...yoloResult.accidents];
        accidentDetections = yoloResult.accidents;
      }
      else if (ENGINE === 'roboflow') {
        const roboResult = await callRoboflow(frame);
        allDetections = roboResult.all || [];
        accidentDetections = roboResult.accidents || [];
      }
      else if (ENGINE === 'both') {
        const [localPreds, yoloResult] = await Promise.all([
          runCOCO(frame, upW, upH),
          callYOLO(frame)
        ]);
        allDetections = [...localPreds, ...yoloResult.vehicles];
        accidentDetections = yoloResult.accidents;
        
        // Add rule-based detection
        const ruleAccidents = detectAccidentsByRules(localPreds);
        if (ruleAccidents.length > 0) {
          accidentDetections = [...accidentDetections, ...ruleAccidents];
        }
      }

      if (!running || myRun !== activeRunId) return;

      // Process accident detections
      const topAccident = accidentDetections.length > 0 ? 
        accidentDetections.sort((a,b) => b.score - a.score)[0] : null;

      if (topAccident) {
        const areaR = boxAreaRatio(topAccident.bbox, upW, upH);
        const minWHOK = Math.min(topAccident.bbox[2], topAccident.bbox[3]) >= STRICT.minBoxWH;
        const sizeOK = areaR <= STRICT.maxBoxAreaRatio && areaR >= STRICT.minBoxAreaRatio;
        const trigOK = topAccident.score >= STRICT.rfTrigger;
        const holdOK = topAccident.score >= STRICT.rfRelease;

        if (sizeOK && minWHOK && trigOK) {
          accStreak++;
          lastAccBox = topAccident.bbox;
        } else if (holdOK) {
          accStreak = Math.max(0, accStreak - 1);
        } else {
          accStreak = Math.max(0, accStreak - 2);
          lastAccBox = null;
        }
      } else {
        accStreak = Math.max(0, accStreak - 2);
        lastAccBox = null;
      }

      const confirmed = accStreak >= STRICT.minFramesConfirm;

      // Calculate scale
      const sx = (els.canvas.width / upW) || 1;
      const sy = (els.canvas.height / upH) || 1;

      // Draw
      if (ctx) {
        ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        drawBoxes(allDetections, sx, sy);

        if (confirmed && lastAccBox) {
          drawBoxes([{
            class: 'accident',
            score: topAccident?.score ?? 1,
            bbox: lastAccBox
          }], sx, sy);

          const now = Date.now();
          if (!accidentActive && (now - lastAccidentTime) > ACCIDENT_COOLDOWN) {
            accidentActive = true;
            lastAccidentTime = now;
            
            window.dispatchEvent(new CustomEvent('accident', {
              detail: {
                box: lastAccBox,
                score: topAccident?.score ?? 1,
                cam: els.camLabel?.textContent || '',
                at: now
              }
            }));

            if (els.beepToggle?.checked) {
              try { beep(); } catch (e) { console.error('Beep error:', e); }
            }
          }
        } else {
          if (accidentActive) {
            accidentActive = false;
            window.dispatchEvent(new CustomEvent('accident:clear', {
              detail: { at: Date.now() }
            }));
          }
        }
      }

    } catch (err) {
      console.error('[Detection] Error:', err);
      if (err?.name === 'SecurityError') {
        banner('CORS: อ่านวิดีโอไม่ได้', 'error');
      } else {
        banner('เกิดข้อผิดพลาดในการตรวจจับ', 'error');
      }
    }
  }

  /* ==================== COCO-SSD (LOCAL) ==================== */
  
  async function runCOCO(frame, w, h) {
    if (!coco) return [];
    
    try {
      const predictions = await coco.detect(frame);
      return predictions
        .filter(p => p.score >= YOLO.minConfVehicle)
        .filter(p => ['car','truck','bus','motorcycle','bicycle','person'].includes(p.class))
        .map(p => ({
          class: p.class === 'person' ? 'person' : canonVehicle(p.class),
          score: p.score,
          bbox: p.bbox // [x, y, width, height]
        }));
    } catch (e) {
      console.error('[COCO-SSD] Error:', e);
      return [];
    }
  }

  /* ==================== YOLO API ==================== */
  
  async function callYOLO(frameCanvas) {
    // ✅ ตรวจสอบว่ามี API URL หรือไม่
    if (!YOLO.apiUrl || YOLO.apiUrl.trim() === '') {
      console.log('[YOLO] API URL not configured - skipping YOLO detection');
      return { vehicles: [], accidents: [] };
    }

    const base64 = frameCanvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), YOLO.timeout);

      const response = await fetch(YOLO.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            base64,
            YOLO.minConfVehicle,
            YOLO.imgSize
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[YOLO] HTTP error:', response.status);
        return { vehicles: [], accidents: [] };
      }

      const result = await response.json();
      console.log('[YOLO] Raw API response:', result);

      // Gradio response format: { data: [{ success: true, predictions: [...] }] }
      const apiResult = result.data?.[0];

      if (!apiResult || !apiResult.success) {
        console.warn('[YOLO] API returned error:', apiResult?.error || 'Unknown error');
        return { vehicles: [], accidents: [] };
      }

      // Parse predictions from API
      const preds = (apiResult.predictions || []).map(p => ({
        class: String(p.class || '').toLowerCase(),
        score: Number(p.confidence || 0),
        bbox: [p.x - p.width/2, p.y - p.height/2, p.width, p.height] // center to corner
      }));

      const vehicles = preds
        .filter(p => ALL_VEHICLE_NAMES.includes(p.class) || Object.keys(VEHICLE_CLASSES).includes(p.class))
        .map(p => ({ ...p, class: canonVehicle(p.class) }))
        .filter(p => p.score >= YOLO.minConfVehicle);

      const accidents = preds
        .filter(p => isAccidentName(p.class))
        .filter(p => p.score >= YOLO.minConfAccident)
        .sort((a, b) => b.score - a.score);

      console.log('[YOLO] Detected:', vehicles.length, 'vehicles,', accidents.length, 'accidents');
      return { vehicles, accidents };

    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn('[YOLO] Timeout');
        banner('YOLO API timeout', 'warning');
      } else {
        console.warn('[YOLO] Network error:', e);
      }
      return { vehicles: [], accidents: [] };
    }
  }

  /* ==================== ROBOFLOW API ==================== */
  
  async function callRoboflow(frameCanvas) {
    if (!ROBOFLOW.apiUrl || !ROBOFLOW.apiKey) {
      console.warn('[Roboflow] Not configured');
      return { all: [], accidents: [] };
    }

    try {
      const base64 = frameCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      const url = `${ROBOFLOW.apiUrl}?api_key=${ROBOFLOW.apiKey}&confidence=${ROBOFLOW.confidence}&overlap=${ROBOFLOW.overlap}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: base64
      });

      if (!response.ok) {
        console.warn('[Roboflow] HTTP error:', response.status);
        return { all: [], accidents: [] };
      }

      const result = await response.json();
      const preds = (result.predictions || []).map(p => ({
        class: String(p.class || '').toLowerCase(),
        score: Number(p.confidence || 0),
        bbox: [
          p.x - p.width/2,
          p.y - p.height/2,
          p.width,
          p.height
        ]
      }));

      const accidents = preds.filter(p => isAccidentName(p.class));
      console.log('[Roboflow] Detected:', preds.length, 'objects,', accidents.length, 'accidents');
      
      return { all: preds, accidents };

    } catch (e) {
      console.error('[Roboflow] Error:', e);
      return { all: [], accidents: [] };
    }
  }

  /* ==================== RULE-BASED ACCIDENT DETECTION ==================== */
  
  function detectAccidentsByRules(detections) {
    const vehicles = detections.filter(d => 
      ['car','truck','bus','motorcycle'].includes(d.class)
    );

    if (vehicles.length < 2) return [];

    const accidents = [];

    // Check for overlapping vehicles
    for (let i = 0; i < vehicles.length; i++) {
      for (let j = i + 1; j < vehicles.length; j++) {
        const iou = calculateIoU(vehicles[i].bbox, vehicles[j].bbox);
        if (iou > 0.15) { // Significant overlap
          // Create synthetic accident box
          const combinedBox = mergeBoundingBoxes([vehicles[i].bbox, vehicles[j].bbox]);
          accidents.push({
            class: 'accident',
            score: 0.65, // Rule-based confidence
            bbox: combinedBox,
            source: 'rule-overlap'
          });
        }
      }
    }

    // Check for high density
    if (vehicles.length >= 3) {
      const totalArea = vehicles.reduce((sum, v) => 
        sum + (v.bbox[2] * v.bbox[3]), 0
      );
      const frameArea = upW * upH;
      const density = totalArea / frameArea;

      if (density > 0.25) {
        const centerBox = calculateCenterBox(vehicles);
        accidents.push({
          class: 'accident',
          score: 0.60,
          bbox: centerBox,
          source: 'rule-density'
        });
      }
    }

    return accidents;
  }

  /* ==================== HELPER FUNCTIONS ==================== */
  
  function boxAreaRatio(bbox, w, h) {
    if (!bbox || bbox.length < 4) return 0;
    const area = bbox[2] * bbox[3];
    const frameArea = (w || upW) * (h || upH);
    return area / frameArea;
  }

  function calculateIoU(boxA, boxB) {
    const [x1A, y1A, wA, hA] = boxA;
    const [x1B, y1B, wB, hB] = boxB;
    
    const x2A = x1A + wA, y2A = y1A + hA;
    const x2B = x1B + wB, y2B = y1B + hB;

    const xOverlap = Math.max(0, Math.min(x2A, x2B) - Math.max(x1A, x1B));
    const yOverlap = Math.max(0, Math.min(y2A, y2B) - Math.max(y1A, y1B));
    const intersection = xOverlap * yOverlap;

    const areaA = wA * hA;
    const areaB = wB * hB;
    const union = areaA + areaB - intersection;

    return union > 0 ? intersection / union : 0;
  }

  function mergeBoundingBoxes(boxes) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    boxes.forEach(([x, y, w, h]) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

    return [minX, minY, maxX - minX, maxY - minY];
  }

  function calculateCenterBox(vehicles) {
    const boxes = vehicles.map(v => v.bbox);
    return mergeBoundingBoxes(boxes);
  }

  function countVehiclesNear(accBox, vehicles, iouThreshold) {
    if (!accBox) return 0;
    return vehicles.filter(v => 
      calculateIoU(accBox.bbox, v.bbox) >= iouThreshold
    ).length;
  }

  /* ==================== DRAWING ==================== */
  
  function drawBoxes(detections, sx, sy) {
    if (!ctx) return;

    detections.forEach(det => {
      const [x, y, w, h] = det.bbox;
      const sx_x = x * sx;
      const sy_y = y * sy;
      const sx_w = w * sx;
      const sy_h = h * sy;

      // Color based on class
      let color = '#00ff00'; // Green
      if (det.class === 'accident') {
        color = '#ff0000'; // Red
      } else if (['car','truck','bus','motorcycle'].includes(det.class)) {
        color = '#00aaff'; // Blue
      }

      // Draw box
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(sx_x, sy_y, sx_w, sy_h);

      // Draw label
      const label = `${det.class} ${Math.round(det.score * 100)}%`;
      ctx.font = 'bold 14px Arial';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = color;
      ctx.fillRect(sx_x, sy_y - 20, textWidth + 10, 20);

      ctx.fillStyle = '#000';
      ctx.fillText(label, sx_x + 5, sy_y - 5);
    });
  }

  /* ==================== UTILITIES ==================== */
  
  function banner(msg, type = 'info') {
    if (!els.alertBanner) {
      console.log('[Banner]', msg);
      return;
    }

    els.alertBanner.textContent = msg;
    els.alertBanner.className = 'alert';
    
    if (type === 'error') els.alertBanner.style.background = 'rgba(255,0,0,0.9)';
    else if (type === 'warning') els.alertBanner.style.background = 'rgba(255,165,0,0.9)';
    else els.alertBanner.style.background = 'rgba(0,123,255,0.9)';

    els.alertBanner.classList.remove('hidden');
    els.alertBanner.classList.add('show');

    setTimeout(() => {
      els.alertBanner.classList.remove('show');
      els.alertBanner.classList.add('hidden');
    }, 3000);
  }

  function beep() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.error('[Beep] Error:', e);
    }
  }

  /* ==================== INITIALIZATION ==================== */
  
  console.log('[Detection] Module loaded');
  console.log('[Detection] Initial engine:', ENGINE);
  
  // Auto-start if needed (uncomment if you want auto-start)
  // window.addEventListener('load', () => {
  //   if (ENGINE !== 'off') startDetection();
  // });

})();
