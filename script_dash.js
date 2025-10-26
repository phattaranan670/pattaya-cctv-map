console.log('🚀 Dashboard starting...');

// ตัวแปรหลัก
var map, heat_map, heatmapOn = true;
var markers = [];
var allDataRaw = []; // ข้อมูลดิบจาก API
var allData = { 2022: [], 2023: [], 2024: [] }; // แยกตามปี
var currentYear = 'all';
var initialCenter = [12.962125659841195, 100.97755083677181];
var initialZoom = 12;
var charts = {};
var monthlyData = {
    2022: Array(12).fill(0),
    2023: Array(12).fill(0),
    2024: Array(12).fill(0)
};

// ฟังก์ชันดึงข้อมูลจาก API
function loadData() {
    console.log('📡 Loading data...');
    document.getElementById('loadingStatus').textContent = 'กำลังเชื่อมต่อ API...';
    
    // ใช้ URL เต็ม
    const url = 'https://pattaya-cctv-kku.infinityfreeapp.com/get_heatmap_data.php?limit=1000';
    
    fetch(url)
        .then(response => {
            console.log('📡 Response:', response.status);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(result => {
            console.log('✅ Data received:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'API Error');
            }
            
            // เก็บข้อมูลดิบ
            if (!result.data || result.data.length === 0) {
                allDataRaw = [];
            } else {
                allDataRaw = result.data.map(d => ({
                    id: d.id,
                    camera_id: d.camera_id,
                    timestamp: d.timestamp,
                    lat: parseFloat(d.lat || d.latitude || 0),
                    lon: parseFloat(d.lon || d.longitude || 0)
                }));
            }
            
            console.log('📊 Total records:', allDataRaw.length);
            
            // แปลงข้อมูล
            processData();
            
            // อัพเดท UI
            updateStats();
            updateMap();
            
            // ซ่อน loading
            document.getElementById('loadingOverlay').classList.add('hidden');
            console.log('✅ Dashboard ready!');
            
        })
        .catch(error => {
            console.error('❌ Error:', error);
            document.getElementById('loadingStatus').innerHTML = 
                `<span style="color: #f56565;">เกิดข้อผิดพลาด: ${error.message}</span>`;
            setTimeout(() => {
                document.getElementById('loadingOverlay').classList.add('hidden');
            }, 3000);
        });
}

// แปลงข้อมูลให้ตรงกับโครงสร้างที่ต้องการ
function processData() {
    console.log('🔄 Processing data...');
    
    // รีเซ็ตข้อมูล
    allData = { 2022: [], 2023: [], 2024: [] };
    monthlyData = {
        2022: Array(12).fill(0),
        2023: Array(12).fill(0),
        2024: Array(12).fill(0)
    };
    
    allDataRaw.forEach(item => {
        const date = new Date(item.timestamp);
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-11
        
        // เพิ่มข้อมูลในรูปแบบ [lat, lon]
        if (allData[year]) {
            allData[year].push([item.lat, item.lon]);
        }
        
        // นับจำนวนรายเดือน
        if (monthlyData[year]) {
            monthlyData[year][month]++;
        }
    });
    
    console.log('✅ Data processed:', {
        2022: allData[2022].length,
        2023: allData[2023].length,
        2024: allData[2024].length
    });
}

function getAllData() {
    return [...allData[2022], ...allData[2023], ...allData[2024]];
}

function getCurrentData() {
    if (currentYear === 'all') {
        return getAllData();
    } else {
        return allData[currentYear];
    }
}

function updateStats() {
    var data = getCurrentData();
    document.getElementById('totalAccidents').textContent = data.length;
    
    var monthCount = currentYear === 'all' ? 36 : 12;
    var avgPerMonth = Math.round(data.length / monthCount * 10) / 10;
    document.getElementById('avgPerMonth').textContent = avgPerMonth;
    
    // คำนวณเดือนสูงสุด
    var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var peakData = currentYear === 'all' ? 
        monthlyData[2022].map((v, i) => v + monthlyData[2023][i] + monthlyData[2024][i]) :
        monthlyData[currentYear];
    var maxIndex = peakData.indexOf(Math.max(...peakData));
    document.getElementById('peakMonth').textContent = months[maxIndex];
    
    // คำนวณแนวโน้ม
    var trend = 0;
    if (currentYear === 'all') {
        if (allData[2022].length > 0) {
            trend = ((allData[2024].length - allData[2022].length) / allData[2022].length * 100).toFixed(1);
        }
    } else {
        if (peakData[0] > 0) {
            trend = ((peakData[peakData.length - 1] - peakData[0]) / peakData[0] * 100).toFixed(1);
        }
    }
    document.getElementById('trendPercent').textContent = (trend > 0 ? '+' : '') + trend + '%';
    
    console.log('📊 Stats updated');
}

function updateMap() {
    console.log('🗺️ Updating map...');
    
    // ลบ heatmap เดิม
    if (heat_map) {
        map.removeLayer(heat_map);
    }
    
    // ลบ markers เดิม
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    var data = getCurrentData();
    
    if (data.length === 0) {
        console.warn('⚠️ No data to display');
        return;
    }
    
    // ดึงค่าจาก slider
    var radius = parseInt(document.getElementById('radiusSlider').value);
    var blur = parseInt(document.getElementById('blurSlider').value);
    var opacity = parseInt(document.getElementById('opacitySlider').value) / 100;
    
    // สร้าง heatmap
    heat_map = L.heatLayer(data, {
        minOpacity: opacity,
        maxZoom: 18,
        radius: radius,
        blur: blur
    });
    
    if (heatmapOn) {
        heat_map.addTo(map);
    }
    
    console.log('✅ Map updated with', data.length, 'points');
}

// Initialize map
console.log('🗺️ Initializing map...');
map = L.map('map').setView(initialCenter, initialZoom);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

console.log('✅ Map initialized');

// โหลดข้อมูล
loadData();

// Year filter buttons
document.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.year-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentYear = this.dataset.year;
        updateStats();
        updateMap();
    });
});

// Sidebar toggle
document.getElementById('toggleSidebar').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

// Toggle open sidebar
document.getElementById('toggleOpen').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

// Heatmap toggle
document.getElementById('toggleHeatmap').addEventListener('click', function() {
    if (heatmapOn) {
        map.removeLayer(heat_map);
        this.innerHTML = '<span>🔥</span><span>แสดง Heatmap</span>';
    } else {
        heat_map.addTo(map);
        this.innerHTML = '<span>🔥</span><span>ซ่อน Heatmap</span>';
    }
    heatmapOn = !heatmapOn;
});

// Reset view
document.getElementById('resetView').addEventListener('click', function() {
    map.setView(initialCenter, initialZoom);
});

// Range sliders
document.getElementById('radiusSlider').addEventListener('input', function() {
    document.getElementById('radiusValue').textContent = this.value;
    updateMap();
});

document.getElementById('blurSlider').addEventListener('input', function() {
    document.getElementById('blurValue').textContent = this.value;
    updateMap();
});

document.getElementById('opacitySlider').addEventListener('input', function() {
    document.getElementById('opacityValue').textContent = this.value;
    updateMap();
});

// Analytics dashboard
document.getElementById('viewAnalytics').addEventListener('click', function() {
    document.getElementById('dashboardModal').classList.add('active');
    setTimeout(() => {
        createCharts();
    }, 100);
});

document.getElementById('closeDashboard').addEventListener('click', function() {
    document.getElementById('dashboardModal').classList.remove('active');
});

function createCharts() {
    console.log('📊 Creating charts...');
    
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    // Update summary stats
    document.getElementById('total2022').textContent = allData[2022].length + ' ครั้ง';
    document.getElementById('total2023').textContent = allData[2023].length + ' ครั้ง';
    document.getElementById('total2024').textContent = allData[2024].length + ' ครั้ง';
    
    var totalAll = allData[2022].length + allData[2023].length + allData[2024].length;
    document.getElementById('totalAllYears').textContent = totalAll + ' จุด';
    document.getElementById('avgPerYear').textContent = Math.round(totalAll / 3) + ' ครั้ง';
    
    var yearCounts = [allData[2022].length, allData[2023].length, allData[2024].length];
    var maxYear = Math.max(...yearCounts);
    var peakYearIndex = yearCounts.indexOf(maxYear);
    document.getElementById('peakYear').textContent = (2022 + peakYearIndex) + ' (' + maxYear + ' ครั้ง)';
    
    // Yearly Comparison Chart
    var ctx1 = document.getElementById('yearlyComparisonChart').getContext('2d');
    charts.yearlyComparison = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
            datasets: [
                {
                    label: '2022',
                    data: monthlyData[2022],
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '2023',
                    data: monthlyData[2023],
                    borderColor: 'rgba(237, 137, 54, 1)',
                    backgroundColor: 'rgba(237, 137, 54, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: '2024',
                    data: monthlyData[2024],
                    borderColor: 'rgba(245, 87, 108, 1)',
                    backgroundColor: 'rgba(245, 87, 108, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
    
    // Year Pie Chart
    var ctx2 = document.getElementById('yearPieChart').getContext('2d');
    charts.yearPie = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['2022', '2023', '2024'],
            datasets: [{
                data: [allData[2022].length, allData[2023].length, allData[2024].length],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(237, 137, 54, 0.8)',
                    'rgba(245, 87, 108, 0.8)'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Trend Chart
    var ctx3 = document.getElementById('trendChart').getContext('2d');
    charts.trend = new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: ['2022', '2023', '2024'],
            datasets: [{
                label: 'จำนวนอุบัติเหตุรวม',
                data: [allData[2022].length, allData[2023].length, allData[2024].length],
                backgroundColor: [
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(237, 137, 54, 0.8)',
                    'rgba(245, 87, 108, 0.8)'
                ],
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 50
                    }
                }
            }
        }
    });
    
    console.log('✅ Charts created');
}
