// เรียกข้อมูลจริงจาก InfinityFree
fetch("https://pattaya-cctv-kku.infinityfreeapp.com/get_heatmap_data.php")
  .then(response => response.json())
  .then(data => {
    console.log("🔥 โหลดข้อมูลจริงจาก InfinityFree:", data);

    if (data.success && data.data) {
      const points = data.data.map(item => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        id: item.id,
        camera_id: item.camera_id,
        timestamp: item.timestamp
      }));

      // เรียกฟังก์ชันที่ใช้ render heatmap ของคุณ
      renderHeatmap(points);
    } else {
      console.error("⚠️ โครงสร้างข้อมูลไม่ถูกต้อง", data);
    }
  })
  .catch(err => {
    console.error("❌ โหลดข้อมูลไม่สำเร็จ:", err);
  });
