// 🔗 URL ของ API จริง
const API_URL = "https://pattaya-cctv-kku.infinityfreeapp.com/get_heatmap_data.php";

// 🔹 ฟังก์ชันโหลดข้อมูลอุบัติเหตุจาก API จริง
async function fetchAccidentData() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
    
    const data = await response.json();

    if (data.success) {
      console.log(`✅ โหลดข้อมูลสำเร็จ: ${data.data.length} รายการ`);
      return data.data;
    } else {
      console.warn("⚠️ API ตอบกลับแต่ไม่มีข้อมูล", data);
      return [];
    }
  } catch (error) {
    console.error("❌ โหลดข้อมูลจาก API ไม่สำเร็จ:", error);
    return [];
  }
}

// 🔹 เรียกใช้งานจริง
fetchAccidentData().then(accidents => {
  // ตัวอย่างแสดงผล
  console.log("ตัวอย่างข้อมูล:", accidents.slice(0, 5));

  // 🔸 ถ้าจะใช้กับ Heatmap หรือแผนที่ Leaflet
  // accidents.forEach(item => {
  //   L.marker([item.lat, item.lon]).addTo(map);
  // });
});
