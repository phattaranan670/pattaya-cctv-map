// Mock Data สำหรับ GitHub Pages
// ข้อมูลจำลองจากระบบ (ใช้แทน API)

const mockAccidentData = {
    success: true,
    data: [
        // สร้างข้อมูลจำลอง 675 รายการ
        ...Array.from({length: 225}, (_, i) => ({
            id: i + 1,
            camera_id: `CAM_${String(Math.floor(Math.random() * 12) + 1).padStart(3, '0')}`,
            timestamp: `2022-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
            lat: 12.92 + Math.random() * 0.09,
            lon: 100.87 + Math.random() * 0.21
        })),
        ...Array.from({length: 225}, (_, i) => ({
            id: i + 226,
            camera_id: `CAM_${String(Math.floor(Math.random() * 12) + 1).padStart(3, '0')}`,
            timestamp: `2023-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
            lat: 12.92 + Math.random() * 0.09,
            lon: 100.87 + Math.random() * 0.21
        })),
        ...Array.from({length: 225}, (_, i) => ({
            id: i + 451,
            camera_id: `CAM_${String(Math.floor(Math.random() * 12) + 1).padStart(3, '0')}`,
            timestamp: `2024-${String(Math.floor(Math.random() * 10) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
            lat: 12.92 + Math.random() * 0.09,
            lon: 100.87 + Math.random() * 0.21
        }))
    ]
};

// ฟังก์ชันจำลองการเรียก API
function fetchMockData() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(mockAccidentData);
        }, 500); // จำลอง network delay
    });
}
