// accident.js
(() => {
  'use strict';

  // ถ้าเห็น accident >= TH ต่อเนื่อง HIT ครั้ง => สถานะ "มีเหตุ"
  // ถ้าไม่เห็นเกิน MISS ครั้ง => "ยุติเหตุ"
  const TH = 0.55;
  const HIT = 3;
  const MISS = 6;

  const S = { on:0, off:0, active:false };

  function update(accBoxes){
    const has = (accBoxes||[]).some(b => (b.class||'').toLowerCase()==='accident' && b.score>=TH);

    if (has){ S.on++; S.off=0; if (!S.active && S.on>=HIT){ S.active=true; fire('start'); } }
    else { S.on=0; S.off++; if (S.active && S.off>=MISS){ S.active=false; fire('end'); } }

    return S.active;
  }

  const L = { start:[], end:[] };
  function on(evt, cb){ (L[evt]||[]).push(cb); }
  function fire(evt){ (L[evt]||[]).forEach(fn=>{ try{ fn(); }catch{} }); }

  // เผย API ออกไป (ถ้าต้องเพิ่ม callback ภายนอก)
  window.accident = { update, on, get active(){ return S.active; } };
})();

// accident.js
(() => {
  'use strict';

  const bannerEl = document.getElementById('alertBanner');
  const videoWrap = document.querySelector('#videoPreview .video-wrap') || document.getElementById('videoPreview');
  const vEl = document.getElementById('videoPlayer');
  const cEl = document.getElementById('overlay');
  const beepToggle = document.getElementById('beepToggle');

  let audioCtx;
  let flashTimer = null;
  let hideTimer  = null;
  let cooldownUntil = 0;   // กันแจ้งซ้ำติดๆ กัน
  const COOLDOWN_MS = 20_000;

  // ---------- Helpers ----------
  function showBanner(msg){
    bannerEl.textContent = msg;
    bannerEl.classList.remove('hidden');
    bannerEl.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hideBanner(), 15_000); // ซ่อนเองหลัง 15 วิ
  }
  function hideBanner(){
    bannerEl.classList.remove('show');
    bannerEl.classList.add('hidden');
  }

  function flashOn(){
    videoWrap?.classList.add('alerting');
    // กระพริบ
    clearInterval(flashTimer);
    flashTimer = setInterval(() => {
      videoWrap?.classList.toggle('alerting-2');
    }, 350);
  }
  function flashOff(){
    clearInterval(flashTimer);
    videoWrap?.classList.remove('alerting', 'alerting-2');
  }

  function playBeepPattern(times = 6, freq = 1000, dur = 0.15, gap = 0.12){
    if (!beepToggle?.checked) return;
    try{
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      let t = audioCtx.currentTime;
      for (let i = 0; i < times; i++){
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
        o.start(t);
        o.stop(t + dur);
        t += dur + gap;
      }
    }catch{}
  }

  function notifyDesktop(title, body, imageDataUrl){
    if (!('Notification' in window)) return;
    const send = () => {
      try {
        new Notification(title, {
          body,
          image: imageDataUrl || undefined
        });
      } catch {}
    };
    if (Notification.permission === 'granted') send();
    else if (Notification.permission !== 'denied'){
      Notification.requestPermission().then(p => (p === 'granted') && send());
    }
  }

  function snapFrame(){
    if (!vEl?.videoWidth) return null;
    const can = document.createElement('canvas');
    const w = vEl.videoWidth, h = vEl.videoHeight;
    can.width = w; can.height = h;
    const ictx = can.getContext('2d');
    ictx.drawImage(vEl, 0, 0, w, h);
    // วาด overlay ซ้ำเพื่อเก็บกรอบ (ถ้าต้องการ)
    try { ictx.drawImage(cEl, 0, 0, w, h); } catch {}
    return can.toDataURL('image/jpeg', 0.9);
  }

  function download(dataUrl, filename='accident.jpg'){
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename;
    a.click();
  }

  // ---------- Listeners ----------
  window.addEventListener('accident', (e) => {
    const now = Date.now();
    if (now < cooldownUntil) return;     // กันสแปม
    cooldownUntil = now + COOLDOWN_MS;

    const {score=1, cam=''} = e.detail || {};
    const pct = Math.round(score * 100);
    const msg = `🚨 Accident Detected${cam ? ' • ' + cam : ''} (${pct}%)`;

    showBanner(msg);
    flashOn();
    playBeepPattern();
    const shot = snapFrame();
    notifyDesktop('Accident Detected', `${cam || ''} • ${pct}%`, shot);

    // โหลดภาพเก็บทันที (ปิดได้ถ้าไม่ต้องการ)
    if (shot) download(shot, `accident_${Date.now()}.jpg`);
  });

  window.addEventListener('accident:clear', () => {
    flashOff();
    hideBanner();
    // beep สั้นๆบอก clear (ปิดได้)
    playBeepPattern(1, 600, 0.08, 0);
  });
})();
