console.log('🚀 Dashboard starting...');

// ================================================================
// GLOBAL VARIABLES
// ================================================================
var map, heat_map, heatmapOn = true;
var markers = [];
var allDataRaw = []; 
var allData = { 2022: [], 2023: [], 2024: [] };
var currentYear = 'all'; 
var initialCenter = [12.962125659841195, 100.97755083677181];
var initialZoom = 12;
var charts = {};
var monthlyData = {
    2022: Array(12).fill(0),
    2023: Array(12).fill(0),
    2024: Array(12).fill(0)
};

// Time Series Variables
let currentMonthIndex = -1; 
const totalMonths = 36; 
let isPlaying = false;
let playInterval = null;
let playSpeed = 800; 

// ================================================================
// DATA LOADING & PROCESSING
// ================================================================

function loadData() {
    console.log('📡 Loading data from API...');
    const loadingStatus = document.getElementById('loadingStatus');
    if (loadingStatus) {
        loadingStatus.textContent = 'กำลังเชื่อมต่อ API...'; 
    }
    
    const url = 'https://pattaya-cctv-kku.infinityfreeapp.com/get_heatmap_data.php?limit=1000';

    fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    })
    .then(response => {
        console.log('📡 Response Status:', response.status);
        console.log('📡 Response Headers:', {
            contentType: response.headers.get('content-type'),
            server: response.headers.get('server')
        });
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            return response.text().then(text => {
                console.error('❌ Response is not JSON. Raw response:', text);
                throw new Error('Server returned non-JSON response. Check PHP file for errors.');
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    })
    .then(result => {
        console.log('📊 API Response received:', {
            success: result.success,
            count: result.count,
            dataLength: result.data ? result.data.length : 0
        });
        
        if (!result.success) {
            throw new Error(result.error || 'API Error: Data retrieval failed');
        }
        
        if (!result.data || result.data.length === 0) {
            console.warn('⚠️ No data received from API');
            throw new Error('ไม่มีข้อมูลในฐานข้อมูล กรุณาเพิ่มข้อมูลก่อน');
        }
        
        allDataRaw = result.data.map(d => {
            const latVal = parseFloat(d.lat || d.latitude || 0);
            const lonVal = parseFloat(d.lon || d.longitude || d.lng || 0);
            const weightVal = parseFloat(d.weight || 1); 

            return {
                id: d.id,
                camera_id: d.camera_id,
                timestamp: d.timestamp,
                lat: latVal,
                lon: lonVal,
                weight: weightVal
            };
        }).filter(d => {
            const isValid = d.lat !== 0 && d.lon !== 0 && 
                           !isNaN(d.lat) && !isNaN(d.lon) &&
                           Math.abs(d.lat) <= 90 && Math.abs(d.lon) <= 180;
            
            if (!isValid) {
                console.warn('⚠️ Invalid coordinates filtered:', d);
            }
            return isValid;
        });
        
        console.log('📊 Valid records after filtering:', allDataRaw.length);
        
        if (allDataRaw.length === 0) {
            throw new Error('ข้อมูลทั้งหมดมีพิกัดไม่ถูกต้อง กรุณาตรวจสอบข้อมูลในฐานข้อมูล');
        }
        
        processData();
        setCurrentView('all'); 
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
        
        console.log('✅ Dashboard ready!');
    })
    .catch(error => {
        console.error('❌ Error loading data:', error);
        console.error('❌ Error stack:', error.stack);
        
        const loadingStatus = document.getElementById('loadingStatus');
        if (loadingStatus) {
            loadingStatus.innerHTML = `
                <div style="color: #f56565; text-align: center;">
                    <strong>เกิดข้อผิดพลาด:</strong><br>
                    ${error.message}<br>
                    <small style="color: #cbd5e0; margin-top: 8px; display: block;">
                        กรุณาเปิด Console (F12) เพื่อดูรายละเอียดเพิ่มเติม
                    </small>
                </div>
            `;
        }
        
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        }, 5000);
    });
}

function processData() {
    console.log('🔄 Processing data...');
    
    allData = { 2022: [], 2023: [], 2024: [] };
    monthlyData = {
        2022: Array(12).fill(0),
        2023: Array(12).fill(0),
        2024: Array(12).fill(0)
    };
    
    allDataRaw.forEach(item => {
        const date = new Date(item.timestamp);
        const year = date.getFullYear();
        const month = date.getMonth();
        
        if (allData[year]) {
            allData[year].push([item.lat, item.lon, item.weight]); 
        }
        
        if (monthlyData[year]) {
            monthlyData[year][month]++;
        }
    });
    
    console.log('✅ Data processed:', {
        '2022': allData[2022].length,
        '2023': allData[2023].length,
        '2024': allData[2024].length
    });
}
// ================================================================
// DATA RETRIEVAL FUNCTIONS
// ================================================================

function getCurrentData() {
    if (currentMonthIndex !== -1) {
        return getDataForMonth(currentMonthIndex);
    } 
    
    if (currentYear === 'all') {
        return [...allData[2022], ...allData[2023], ...allData[2024]];
    } else {
        return allData[currentYear];
    }
}

function getDataForMonth(monthIndex) {
    const year = 2022 + Math.floor(monthIndex / 12);
    const month = monthIndex % 12;

    return allDataRaw
        .filter(item => {
            const date = new Date(item.timestamp);
            const itemYear = date.getFullYear();
            const itemMonth = date.getMonth();
            return itemYear === year && itemMonth === month;
        })
        .map(item => [item.lat, item.lon, item.weight]); 
}

// ================================================================
// VIEW MANAGEMENT
// ================================================================

function setCurrentView(viewType, index = -1) {
    if (viewType === 'time_series') {
        currentMonthIndex = index;
        currentYear = 'all'; 
    } else {
        currentMonthIndex = -1; 
        currentYear = viewType;
    }

    updateUIForTimeSeries();
    updateYearButtons();
    updateStats();
    updateMap();
}

// ================================================================
// STATISTICS UPDATE
// ================================================================

function updateStats() {
    var data = getCurrentData();
    var dataLength = data.length;

    const totalAccidentsEl = document.getElementById('totalAccidents');
    if (totalAccidentsEl) {
        totalAccidentsEl.textContent = dataLength;
    }
    
    var monthCount = (currentYear === 'all' && currentMonthIndex === -1) ? 36 : 
                     (currentMonthIndex !== -1 ? 1 : 12);
    
    var avgMonth = monthCount > 0 ? (dataLength / monthCount).toFixed(1) : 0;
    const avgPerMonthEl = document.getElementById('avgMonth');
    if (avgPerMonthEl) {
        avgPerMonthEl.textContent = avgMonth;
    }
    
    var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var peakData;
    
    if (currentYear === 'all' && currentMonthIndex === -1) {
        peakData = monthlyData[2022].map((v, i) => 
            v + monthlyData[2023][i] + monthlyData[2024][i]
        );
    } else if (currentMonthIndex !== -1) {
        peakData = [dataLength]; 
    } else {
        peakData = monthlyData[currentYear];
    }

    var maxIndex = peakData.indexOf(Math.max(...peakData));
    const peakMonthEl = document.getElementById('peakMonth');
    if (peakMonthEl) {
        if (currentMonthIndex !== -1) {
            peakMonthEl.textContent = months[currentMonthIndex % 12];
        } else {
            peakMonthEl.textContent = months[maxIndex];
        }
    }
    
    var trend = 0;
    if (currentYear === 'all' && currentMonthIndex === -1) {
        const len2022 = allData[2022].length;
        const len2024 = allData[2024].length;
        trend = len2022 > 0 ? ((len2024 - len2022) / len2022 * 100).toFixed(1) : 0;
    } else if (currentMonthIndex !== -1) {
        const prevIndex = currentMonthIndex - 1;
        if (prevIndex >= 0) {
            const currentCount = dataLength;
            const prevData = getDataForMonth(prevIndex);
            const prevCount = prevData.length;
            trend = prevCount > 0 ? ((currentCount - prevCount) / prevCount * 100).toFixed(1) : 0;
        }
    }

    const trendPercentEl = document.getElementById('trendPercent');
    if (trendPercentEl) {
        trendPercentEl.textContent = (trend > 0 ? '+' : '') + trend + '%';
        
        var trendElement = trendPercentEl.closest('.stat-trend');
        if (trendElement) {
            trendElement.classList.remove('up', 'down', 'neutral');
            if (trend > 0) trendElement.classList.add('up');
            else if (trend < 0) trendElement.classList.add('down');
            else trendElement.classList.add('neutral');
        }
    }
    
    if (document.getElementById('total2022')) {
        document.getElementById('total2022').textContent = allData[2022].length + ' ครั้ง';
    }
    if (document.getElementById('total2023')) {
        document.getElementById('total2023').textContent = allData[2023].length + ' ครั้ง';
    }
    if (document.getElementById('total2024')) {
        document.getElementById('total2024').textContent = allData[2024].length + ' ครั้ง';
    }
    
    var totalAll = allData[2022].length + allData[2023].length + allData[2024].length;
    if (document.getElementById('totalAllYears')) {
        document.getElementById('totalAllYears').textContent = totalAll + ' จุด';
    }
    if (document.getElementById('avgYear')) {
        document.getElementById('avgYear').textContent = Math.round(totalAll / 3) + ' ครั้ง';
    }
    
    var yearCounts = [allData[2022].length, allData[2023].length, allData[2024].length];
    var maxYear = Math.max(...yearCounts);
    var stdDevIndex = yearCounts.indexOf(maxYear);
    if (document.getElementById('stdDev')) {
        document.getElementById('stdDev').textContent = (2022 + stdDevIndex) + ' (' + maxYear + ' ครั้ง)';
    }
    
    // Update Time Series Stats in Sidebar
    if (currentMonthIndex !== -1) {
        // Update month accidents
        const monthAccidentsEl = document.getElementById('monthAccidents');
        if (monthAccidentsEl) {
            monthAccidentsEl.textContent = dataLength;
        }
        
        // Calculate cumulative accidents up to current month
        let cumulativeCount = 0;
        for (let i = 0; i <= currentMonthIndex; i++) {
            const monthData = getDataForMonth(i);
            cumulativeCount += monthData.length;
        }
        const cumulativeAccidentsEl = document.getElementById('cumulativeAccidents');
        if (cumulativeAccidentsEl) {
            cumulativeAccidentsEl.textContent = cumulativeCount;
        }
        
        // Calculate year progress
        const monthInYear = currentMonthIndex % 12;
        const yearProgressPercent = Math.round(((monthInYear + 1) / 12) * 100);
        const yearProgressEl = document.getElementById('yearProgress');
        if (yearProgressEl) {
            yearProgressEl.textContent = yearProgressPercent + '%';
        }
        
        // Calculate average comparison
        const totalMonthsCompleted = currentMonthIndex + 1;
        const avgSoFar = totalMonthsCompleted > 0 ? (cumulativeCount / totalMonthsCompleted).toFixed(1) : 0;
        const avgComparisonEl = document.getElementById('avgComparison');
        if (avgComparisonEl) {
            avgComparisonEl.textContent = avgSoFar;
        }
        
        // Update trend indicator
        const trendIndicatorEl = document.getElementById('trendIndicator');
        if (trendIndicatorEl && currentMonthIndex > 0) {
            const prevMonthData = getDataForMonth(currentMonthIndex - 1);
            const prevCount = prevMonthData.length;
            const diff = dataLength - prevCount;
            const trendPercent = prevCount > 0 ? ((diff / prevCount) * 100).toFixed(1) : 0;
            
            trendIndicatorEl.classList.remove('up', 'down', 'neutral');
            if (diff > 0) {
                trendIndicatorEl.classList.add('up');
                trendIndicatorEl.innerHTML = `<span>↗</span><span>+${diff} (${trendPercent > 0 ? '+' : ''}${trendPercent}%)</span>`;
            } else if (diff < 0) {
                trendIndicatorEl.classList.add('down');
                trendIndicatorEl.innerHTML = `<span>↘</span><span>${diff} (${trendPercent}%)</span>`;
            } else {
                trendIndicatorEl.classList.add('neutral');
                trendIndicatorEl.innerHTML = `<span>—</span><span>ไม่เปลี่ยนแปลง</span>`;
            }
        } else if (trendIndicatorEl && currentMonthIndex === 0) {
            trendIndicatorEl.classList.remove('up', 'down');
            trendIndicatorEl.classList.add('neutral');
            trendIndicatorEl.innerHTML = `<span>—</span><span>เดือนแรก</span>`;
        }
    }

    console.log(' Stats updated');
}

// ================================================================
// MAP UPDATE
// ================================================================

function updateMap() {
    console.log('🗺 Updating map...');
    
    if (heat_map) {
        map.removeLayer(heat_map);
    }
    
    var data = getCurrentData();
    
    if (data.length === 0) {
        console.warn('⚠️ No data to display');
        return;
    }
    
    var radius = 40;
    if (document.getElementById('radiusSlider')) {
        radius = parseInt(document.getElementById('radiusSlider').value);
    }
    
    var blur = 40;
    if (document.getElementById('blurSlider')) {
        blur = parseInt(document.getElementById('blurSlider').value);
    }

    var opacity = 0.6;
    if (document.getElementById('opacitySlider')) {
        opacity = parseInt(document.getElementById('opacitySlider').value) / 100;
    }
    
    heat_map = L.heatLayer(data, {
        minOpacity: opacity,
        maxZoom: 18,
        radius: radius,
        blur: blur,
        gradient: {
            0.0: 'blue',
            0.5: 'lime',
            0.7: 'yellow',
            1.0: 'red'
        }
    });
    
    if (heatmapOn) {
        heat_map.addTo(map);
    }
    
    console.log('✅ Map updated with', data.length, 'points');
}

// ================================================================
// MAP INITIALIZATION
// ================================================================

console.log('🗺 Initializing map...');
map = L.map('map', {
    zoomControl: false  // ปิด zoom control แบบ default
}).setView(initialCenter, initialZoom);

// เพิ่ม zoom control ที่มุมขวาบน
L.control.zoom({
    position: 'topright'
}).addTo(map);
    
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);
    
console.log('✅ Map initialized');
    
loadData();

// ================================================================
// YEAR FILTER BUTTONS
// ================================================================

function updateYearButtons() {
    document.querySelectorAll('.year-btn, .year-selector-btn').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.year === currentYear && currentMonthIndex === -1) {
            b.classList.add('active');
        } else if (b.dataset.year === 'all' && currentYear === 'all' && currentMonthIndex === -1) {
            b.classList.add('active');
        }
    });
}

document.querySelectorAll('.year-btn, .year-selector-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        setCurrentView(this.dataset.year);
        // Update charts if dashboard is open
        const dashboardModal = document.getElementById('dashboardModal');
        if (dashboardModal && dashboardModal.classList.contains('active')) {
            setTimeout(() => createCharts(), 100);
        }
    });
});

// ================================================================
// SIDEBAR CONTROLS - แก้ไขให้ทำงานได้ดีขึ้น
// ================================================================

const closeSidebar = document.getElementById('closeSidebar');
if (closeSidebar) {
    closeSidebar.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('🔴 Close sidebar clicked');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
            console.log('✅ Sidebar collapsed');
        } else {
            console.error('❌ Sidebar element not found');
        }
    });
} else {
    console.warn('⚠️ closeSidebar button not found');
}

const toggleOpen = document.getElementById('toggleOpen');
if (toggleOpen) {
    toggleOpen.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('📖 Toggle sidebar open clicked');
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            console.log('✅ Sidebar opened');
        } else {
            console.error('❌ Sidebar element not found');
        }
    });
} else {
    console.warn('⚠️ toggleOpen button not found');
}

const backHome = document.getElementById('backHome');
if (backHome) {
    backHome.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('🏠 Back home clicked');
        window.location.href = 'index.html';
    });
} else {
    console.warn('⚠️ backHome button not found');
}

// ================================================================
// HEATMAP CONTROLS
// ================================================================

const toggleHeatmap = document.getElementById('toggleHeatmap');
if (toggleHeatmap) {
    toggleHeatmap.addEventListener('click', function() {
        if (heatmapOn) {
            if (heat_map) map.removeLayer(heat_map);
            this.innerHTML = '<span></span><span>แสดง Heatmap</span>';
        } else {
            if (heat_map) heat_map.addTo(map);
            this.innerHTML = '<span></span><span>ซ่อน Heatmap</span>';
        }
        heatmapOn = !heatmapOn;
    });
}

const resetView = document.getElementById('resetView');
if (resetView) {
    resetView.addEventListener('click', function() {
        map.setView(initialCenter, initialZoom);
    });
}

// ================================================================
// MAP ZOOM CONTROLS - เพิ่ม Event Listeners สำหรับปุ่ม + และ -
// ================================================================

// Leaflet จัดการปุ่ม zoom เองอัตโนมัติ แต่ถ้าต้องการควบคุมเพิ่มเติม:
map.on('zoomend', function() {
    console.log('🔍 Current zoom level:', map.getZoom());
});

// เพิ่ม custom zoom buttons (ถ้ามี)
const zoomInBtn = document.querySelector('.leaflet-control-zoom-in');
const zoomOutBtn = document.querySelector('.leaflet-control-zoom-out');

if (zoomInBtn) {
    zoomInBtn.addEventListener('click', function() {
        console.log('➕ Zoom in clicked');
    });
}

if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', function() {
        console.log('➖ Zoom out clicked');
    });
}

// ================================================================
// HEATMAP PARAMETER SLIDERS
// ================================================================

const radiusSlider = document.getElementById('radiusSlider');
if (radiusSlider) {
    radiusSlider.addEventListener('input', function() {
        const radiusValue = document.getElementById('radiusValue');
        if (radiusValue) radiusValue.textContent = this.value;
        updateMap();
    });
}

const blurSlider = document.getElementById('blurSlider');
if (blurSlider) {
    blurSlider.addEventListener('input', function() {
        const blurValue = document.getElementById('blurValue');
        if (blurValue) blurValue.textContent = this.value;
        updateMap();
    });
}

const opacitySlider = document.getElementById('opacitySlider');
if (opacitySlider) {
    opacitySlider.addEventListener('input', function() {
        const opacityValue = document.getElementById('opacityValue');
        if (opacityValue) opacityValue.textContent = this.value;
        updateMap();
    });
}

// ================================================================
// ANALYTICS DASHBOARD MODAL
// ================================================================

const viewAnalytics = document.getElementById('viewAnalytics');
if (viewAnalytics) {
    viewAnalytics.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('🎯 Opening Analytics Dashboard...');
        
        const dashboardModal = document.getElementById('dashboardModal');
        if (!dashboardModal) {
            console.error('❌ dashboardModal element not found!');
            alert('Error: Dashboard modal not found in HTML');
            return;
        }
        
        // Show modal
        dashboardModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
        
        // Wait for modal to be visible before creating charts
        setTimeout(() => {
            console.log('📊 Creating charts after modal is visible...');
            createCharts();
        }, 350);
    });
} else {
    console.warn('⚠️ viewAnalytics button not found');
}

const closeDashboard = document.getElementById('closeDashboard');
if (closeDashboard) {
    closeDashboard.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('❌ Closing Analytics Dashboard...');
        
        const dashboardModal = document.getElementById('dashboardModal');
        if (dashboardModal) {
            dashboardModal.classList.remove('active');
            document.body.style.overflow = ''; // Restore scroll
            console.log('✅ Dashboard closed');
        } else {
            console.error('❌ dashboardModal element not found!');
        }
    });
} else {
    console.warn('⚠️ closeDashboard button not found');
}

// Close modal when clicking outside
const dashboardModal = document.getElementById('dashboardModal');
if (dashboardModal) {
    dashboardModal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Dashboard closed (clicked outside)');
        }
    });
}

// ================================================================
// CHART.JS FUNCTIONS
// ================================================================

function createCharts() {
    console.log('📊 Creating charts...');
    
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js is not loaded!');
        alert('Error: Chart.js library not loaded. Please check your HTML includes:\n<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>');
        return;
    }
    
    // Destroy existing charts
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            try {
                charts[key].destroy();
                console.log(`🗑️ Destroyed chart: ${key}`);
            } catch (e) {
                console.warn('Could not destroy chart:', key, e);
            }
        }
    });
    
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    // Chart 1: Monthly Trend
    const monthlyCtx = document.getElementById('monthlyChart');
    if (!monthlyCtx) {
        console.error('❌ Canvas element "monthlyChart" not found in HTML!');
    } else {
        try {
            const monthlyLabels = monthNames;
            const monthlyDataset = currentYear === 'all' ? 
                monthNames.map((m, i) => monthlyData[2022][i] + monthlyData[2023][i] + monthlyData[2024][i]) :
                monthlyData[currentYear];
            
            charts.monthly = new Chart(monthlyCtx, {
                type: 'line',
                data: {
                    labels: monthlyLabels,
                    datasets: [{
                        label: 'จำนวนอุบัติเหตุ',
                        data: monthlyDataset,
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: '#e5e7eb', font: { size: 14 } }
                        },
                        title: {
                            display: true,
                            text: 'การเปรียบเทียบรายเดือน',
                            color: '#e5e7eb',
                            font: { size: 16, weight: 'bold' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#9ca3af', font: { size: 12 } },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        },
                        x: {
                            ticks: { color: '#9ca3af', font: { size: 12 } },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        }
                    }
                }
            });
            console.log('✅ Monthly chart created successfully');
        } catch (e) {
            console.error('❌ Error creating monthly chart:', e);
            console.error('Stack:', e.stack);
        }
    }
    
    // Chart 2: Yearly Comparison
    const yearlyCtx = document.getElementById('yearlyChart');
    if (!yearlyCtx) {
        console.error('❌ Canvas element "yearlyChart" not found in HTML!');
    } else {
        try {
            charts.yearly = new Chart(yearlyCtx, {
                type: 'bar',
                data: {
                    labels: ['2022', '2023', '2024'],
                    datasets: [{
                        label: 'จำนวนอุบัติเหตุ',
                        data: [
                            allData[2022].length,
                            allData[2023].length,
                            allData[2024].length
                        ],
                        backgroundColor: [
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(16, 185, 129, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                        ],
                        borderColor: [
                            'rgb(59, 130, 246)',
                            'rgb(16, 185, 129)',
                            'rgb(239, 68, 68)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: '#e5e7eb', font: { size: 14 } }
                        },
                        title: {
                            display: true,
                            text: 'สีคล้วนครมช่วงเวลา',
                            color: '#e5e7eb',
                            font: { size: 16, weight: 'bold' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#9ca3af', font: { size: 12 } },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        },
                        x: {
                            ticks: { color: '#9ca3af', font: { size: 12 } },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        }
                    }
                }
            });
            console.log('✅ Yearly chart created successfully');
        } catch (e) {
            console.error('❌ Error creating yearly chart:', e);
            console.error('Stack:', e.stack);
        }
    }
    
    // Chart 3: Pie Chart - Distribution
    const pieCtx = document.getElementById('pieChart');
    if (!pieCtx) {
        console.error('❌ Canvas element "pieChart" not found in HTML!');
    } else {
        try {
            charts.pie = new Chart(pieCtx, {
                type: 'pie',
                data: {
                    labels: ['2022', '2023', '2024'],
                    datasets: [{
                        data: [
                            allData[2022].length,
                            allData[2023].length,
                            allData[2024].length
                        ],
                        backgroundColor: [
                            'rgba(59, 130, 246, 0.8)',
                            'rgba(16, 185, 129, 0.8)',
                            'rgba(239, 68, 68, 0.8)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: { color: '#e5e7eb', font: { size: 12 } }
                        }
                    }
                }
            });
            console.log('✅ Pie chart created successfully');
        } catch (e) {
            console.error('❌ Error creating pie chart:', e);
        }
    }
    
    // Chart 4: Moving Average
    const maCtx = document.getElementById('maChart');
    if (!maCtx) {
        console.error('❌ Canvas element "maChart" not found in HTML!');
    } else {
        try {
            // Calculate 3-month moving average
            const allMonthsData = [];
            for (let year = 2022; year <= 2024; year++) {
                for (let month = 0; month < 12; month++) {
                    allMonthsData.push(monthlyData[year][month]);
                }
            }
            
            const movingAvg = [];
            for (let i = 0; i < allMonthsData.length; i++) {
                if (i < 2) {
                    movingAvg.push(null);
                } else {
                    const avg = (allMonthsData[i-2] + allMonthsData[i-1] + allMonthsData[i]) / 3;
                    movingAvg.push(avg.toFixed(1));
                }
            }
            
            const labels36 = [];
            for (let year = 2022; year <= 2024; year++) {
                for (let month = 0; month < 12; month++) {
                    labels36.push(`${monthNames[month]} ${year}`);
                }
            }
            
            charts.ma = new Chart(maCtx, {
                type: 'line',
                data: {
                    labels: labels36,
                    datasets: [
                        {
                            label: 'จำนวนจริง',
                            data: allMonthsData,
                            borderColor: 'rgba(156, 163, 175, 0.5)',
                            backgroundColor: 'transparent',
                            tension: 0.1
                        },
                        {
                            label: 'Moving Avg (3m)',
                            data: movingAvg,
                            borderColor: 'rgb(239, 68, 68)',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            tension: 0.4,
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: '#e5e7eb', font: { size: 12 } }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#9ca3af', font: { size: 10 } },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        },
                        x: {
                            ticks: { 
                                color: '#9ca3af', 
                                font: { size: 8 },
                                maxRotation: 45,
                                minRotation: 45
                            },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        }
                    }
                }
            });
            console.log('✅ Moving average chart created successfully');
        } catch (e) {
            console.error('❌ Error creating MA chart:', e);
        }
    }
    
    // Chart 5: Heatmap Chart
    const heatmapCtx = document.getElementById('heatmapChart');
    if (!heatmapCtx) {
        console.error('❌ Canvas element "heatmapChart" not found in HTML!');
    } else {
        try {
            // Prepare heatmap data (year x month)
            const heatmapData = [];
            for (let year = 2022; year <= 2024; year++) {
                for (let month = 0; month < 12; month++) {
                    heatmapData.push({
                        x: monthNames[month],
                        y: year.toString(),
                        v: monthlyData[year][month]
                    });
                }
            }
            
            // Convert to matrix format
            const matrix = monthNames.map(month => {
                return [2022, 2023, 2024].map(year => {
                    const monthIdx = monthNames.indexOf(month);
                    return monthlyData[year][monthIdx];
                });
            });
            
            charts.heatmap = new Chart(heatmapCtx, {
                type: 'bar',
                data: {
                    labels: monthNames,
                    datasets: [
                        {
                            label: '2022',
                            data: monthlyData[2022],
                            backgroundColor: 'rgba(59, 130, 246, 0.7)'
                        },
                        {
                            label: '2023',
                            data: monthlyData[2023],
                            backgroundColor: 'rgba(16, 185, 129, 0.7)'
                        },
                        {
                            label: '2024',
                            data: monthlyData[2024],
                            backgroundColor: 'rgba(239, 68, 68, 0.7)'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { color: '#e5e7eb', font: { size: 12 } }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            stacked: false,
                            ticks: { color: '#9ca3af', font: { size: 10 } },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        },
                        x: {
                            stacked: false,
                            ticks: { color: '#9ca3af', font: { size: 10 } },
                            grid: { color: 'rgba(75, 85, 99, 0.3)' }
                        }
                    }
                }
            });
            console.log('✅ Heatmap chart created successfully');
        } catch (e) {
            console.error('❌ Error creating heatmap chart:', e);
        }
    }
    
    // Update Dashboard Stats
    updateDashboardStats();
    
    console.log('✅ All charts creation completed');
}

// ================================================================
// UPDATE DASHBOARD STATS
// ================================================================

function updateDashboardStats() {
    console.log('📊 Updating dashboard stats...');
    
    const totalAll = allData[2022].length + allData[2023].length + allData[2024].length;
    const avgMonth = (totalAll / 36).toFixed(1);
    
    // Calculate standard deviation
    const allMonthsData = [];
    for (let year = 2022; year <= 2024; year++) {
        for (let month = 0; month < 12; month++) {
            allMonthsData.push(monthlyData[year][month]);
        }
    }
    const mean = totalAll / 36;
    const squaredDiffs = allMonthsData.map(x => Math.pow(x - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / 36;
    const stdDev = Math.sqrt(variance).toFixed(2);
    
    // Find max and min months
    const maxValue = Math.max(...allMonthsData);
    const minValue = Math.min(...allMonthsData);
    const maxIndex = allMonthsData.indexOf(maxValue);
    const minIndex = allMonthsData.indexOf(minValue);
    
    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 
                        'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    
    const maxYear = 2022 + Math.floor(maxIndex / 12);
    const maxMonth = maxIndex % 12;
    const minYear = 2022 + Math.floor(minIndex / 12);
    const minMonth = minIndex % 12;
    
    // Calculate YoY change
    const total2022 = allData[2022].length;
    const total2024 = allData[2024].length;
    const yoyChange = total2022 > 0 ? (((total2024 - total2022) / total2022) * 100).toFixed(1) : 0;
    
    // Determine trend
    let overallTrend = 'คงที่';
    if (yoyChange > 5) overallTrend = 'เพิ่มขึ้น ↗';
    else if (yoyChange < -5) overallTrend = 'ลดลง ↘';
    
    // Update DOM elements
    if (document.getElementById('totalAll')) {
        document.getElementById('totalAll').textContent = totalAll.toLocaleString();
    }
    if (document.getElementById('avgMonth')) {
        document.getElementById('avgMonth').textContent = avgMonth;
    }
    if (document.getElementById('stdDev')) {
        document.getElementById('stdDev').textContent = stdDev;
    }
    if (document.getElementById('maxMonth')) {
        document.getElementById('maxMonth').textContent = `${monthNames[maxMonth]} ${maxYear}`;
    }
    if (document.getElementById('maxValue')) {
        document.getElementById('maxValue').textContent = maxValue;
    }
    if (document.getElementById('minMonth')) {
        document.getElementById('minMonth').textContent = `${monthNames[minMonth]} ${minYear}`;
    }
    if (document.getElementById('overallTrend')) {
        document.getElementById('overallTrend').textContent = overallTrend;
    }
    if (document.getElementById('yoyChange')) {
        const yoyEl = document.getElementById('yoyChange');
        yoyEl.textContent = (yoyChange > 0 ? '+' : '') + yoyChange + '%';
        yoyEl.style.color = yoyChange > 0 ? '#ef4444' : (yoyChange < 0 ? '#10b981' : '#9ca3af');
    }
    if (document.getElementById('variance')) {
        document.getElementById('variance').textContent = variance.toFixed(2);
    }
    
    console.log('✅ Dashboard stats updated');
}

// ================================================================
// TIME SERIES CONTROLS
// ================================================================

function updateUIForTimeSeries() {
    const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
                        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

    const currentMonthEl = document.getElementById("currentMonth");
    const monthCountEl = document.getElementById("monthCount");
    const timelineSliderEl = document.getElementById("timelineSlider");
    const timelineControlsEl = document.getElementById('timelineControls');
    const timeInfoBoxEl = document.getElementById('timeInfoBox');
    const timeInfoMonthEl = document.getElementById('timeInfoMonth');
    const timeInfoCountEl = document.getElementById('timeInfoCount');

    if (currentMonthIndex === -1) {
        if (currentMonthEl) currentMonthEl.textContent = 'ข้อมูลรวมทั้งหมด';
        if (monthCountEl) monthCountEl.textContent = '3 ปี (2022-2024)';
        if (timelineSliderEl) timelineSliderEl.value = -1;
        if (timelineControlsEl) timelineControlsEl.classList.add('hidden');
        if (timeInfoBoxEl) timeInfoBoxEl.classList.remove('active');
        return;
    }
    
    const year = 2022 + Math.floor(currentMonthIndex / 12);
    const month = currentMonthIndex % 12;
    
    if (currentMonthEl) {
        currentMonthEl.textContent = `${monthNames[month]} ${year}`;
    }
    if (monthCountEl) {
        monthCountEl.textContent = `เดือนที่ ${currentMonthIndex + 1} จาก ${totalMonths}`;
    }
    if (timelineSliderEl) {
        timelineSliderEl.value = currentMonthIndex;
    }
    
    if (timelineControlsEl) timelineControlsEl.classList.remove('hidden');
    if (timeInfoBoxEl) timeInfoBoxEl.classList.add('active');

    document.querySelectorAll(".month-marker").forEach((marker, index) => {
        marker.classList.remove("active");
        if (index === month) {
            marker.classList.add("active");
        }
    });

    if (timeInfoMonthEl) {
        timeInfoMonthEl.textContent = `${monthNames[month]} ${year}`;
    }
    if (timeInfoCountEl) {
        timeInfoCountEl.textContent = `${getDataForMonth(currentMonthIndex).length} ครั้ง`;
    }

    console.log(`⏰ Time Series: ${monthNames[month]} ${year}`);
}

function togglePlay() {
    const playPauseEl = document.getElementById("playPause");

    if (isPlaying) {
        clearInterval(playInterval);
        playInterval = null;
        if (playPauseEl) {
            playPauseEl.innerHTML = '▶️<span>เล่น</span>';
            playPauseEl.classList.remove('playing');
        }
    } else {
        if (currentMonthIndex === -1) {
            currentMonthIndex = 0;
        }
        
        playInterval = setInterval(() => {
            if (currentMonthIndex < totalMonths - 1) {
                currentMonthIndex++;
                setCurrentView('time_series', currentMonthIndex);
            } else {
                togglePlay();
            }
        }, playSpeed);

        if (playPauseEl) {
            playPauseEl.innerHTML = '⏸️<span>หยุด</span>';
            playPauseEl.classList.add('playing');
        }
    }
    isPlaying = !isPlaying;
}

// ================================================================
// SIDEBAR TOGGLE EVENT LISTENERS
// ================================================================

// ปุ่มปิด Sidebar (ปุ่ม X)
const toggleSidebar = document.getElementById("toggleSidebar");
if (toggleSidebar) {
    toggleSidebar.addEventListener("click", function() {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.classList.toggle("collapsed");
            console.log('🔄 Sidebar toggled (X button)');
        }
    });
}

// ปุ่มเปิด Sidebar (ปุ่มแฮมเบอร์เกอร์)
const toggleDesktop = document.getElementById("toggleDesktop");
if (toggleDesktop) {
    toggleDesktop.addEventListener("click", function() {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
            sidebar.classList.toggle("collapsed");
            console.log('🔄 Sidebar toggled (hamburger button)');
        }
    });
}

// ================================================================
// TIME SERIES EVENT LISTENERS
// ================================================================

const timelineSlider = document.getElementById("timelineSlider");
if (timelineSlider) {
    timelineSlider.addEventListener("input", function(e) {
        if (isPlaying) togglePlay();
        setCurrentView('time_series', parseInt(e.target.value));
    });
}

const prevMonth = document.getElementById("prevMonth");
if (prevMonth) {
    prevMonth.addEventListener("click", function() {
        if (isPlaying) togglePlay();
        if (currentMonthIndex === -1) {
            setCurrentView('time_series', totalMonths - 1); 
        } else if (currentMonthIndex > 0) {
            setCurrentView('time_series', currentMonthIndex - 1);
        }
    });
}

const nextMonth = document.getElementById("nextMonth");
if (nextMonth) {
    nextMonth.addEventListener("click", function() {
        if (isPlaying) togglePlay();
        if (currentMonthIndex === -1) {
            setCurrentView('time_series', 0); 
        } else if (currentMonthIndex < totalMonths - 1) {
            setCurrentView('time_series', currentMonthIndex + 1);
        }
    });
}

const playPause = document.getElementById("playPause");
if (playPause) {
    playPause.addEventListener("click", togglePlay);
}

document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        playSpeed = parseInt(this.dataset.speed);
        
        if (isPlaying) {
            togglePlay();
            togglePlay();
        }
    });
});

const toggleTimeSeries = document.getElementById('toggleTimeSeries');
if (toggleTimeSeries) {
    toggleTimeSeries.addEventListener('click', function() {
        if (currentMonthIndex === -1) {
            setCurrentView('time_series', 0);
        } else {
            setCurrentView('all');
            if (isPlaying) togglePlay(); 
        }
    });
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

function debugData() {
    console.log('=== DEBUG DATA ===');
    console.log('Current Year:', currentYear);
    console.log('Current Month Index:', currentMonthIndex);
    console.log('Total Raw Data:', allDataRaw.length);
    console.log('Data by Year:', {
        2022: allData[2022].length,
        2023: allData[2023].length,
        2024: allData[2024].length
    });
    console.log('Monthly Data:', monthlyData);
    console.log('Current View Data:', getCurrentData().length);
    console.log('Is Playing:', isPlaying);
    console.log('Play Speed:', playSpeed);
    console.log('Charts:', Object.keys(charts));
    console.log('==================');
}

window.debugDashboard = debugData;

// ================================================================
// KEYBOARD SHORTCUTS
// ================================================================

document.addEventListener('keydown', function(e) {
    // ESC to close dashboard
    if (e.key === 'Escape') {
        const dashboardModal = document.getElementById('dashboardModal');
        if (dashboardModal && dashboardModal.classList.contains('active')) {
            dashboardModal.classList.remove('active');
            document.body.style.overflow = '';
            console.log('✅ Dashboard closed (ESC key)');
        }
    }
    
    // Space to play/pause (only when in time series mode)
    if (e.key === ' ' && currentMonthIndex !== -1) {
        e.preventDefault();
        togglePlay();
    }
    
    // Arrow keys for navigation (only when in time series mode)
    if (currentMonthIndex !== -1) {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (isPlaying) togglePlay();
            if (currentMonthIndex > 0) {
                setCurrentView('time_series', currentMonthIndex - 1);
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (isPlaying) togglePlay();
            if (currentMonthIndex < totalMonths - 1) {
                setCurrentView('time_series', currentMonthIndex + 1);
            }
        }
    }
});

// ================================================================
// PERFORMANCE MONITORING
// ================================================================

window.addEventListener('load', function() {
    console.log('📊 Dashboard Performance:');
    if (window.performance && window.performance.timing) {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        const connectTime = perfData.responseEnd - perfData.requestStart;
        const renderTime = perfData.domComplete - perfData.domLoading;
        
        console.log(`  ⏱️ Page Load: ${pageLoadTime}ms`);
        console.log(`  🌐 Network: ${connectTime}ms`);
        console.log(`  🎨 Render: ${renderTime}ms`);
    }
});

// ================================================================
// ERROR HANDLER
// ================================================================

window.addEventListener('error', function(e) {
    console.error('❌ Global Error:', e.error);
    console.error('   Message:', e.message);
    console.error('   File:', e.filename);
    console.error('   Line:', e.lineno);
});

console.log('✅ Dashboard script loaded successfully!');
console.log('💡 Tips:');
console.log('   - Type debugDashboard() in console to see data state');
console.log('   - Press ESC to close Analytics Dashboard');
console.log('   - Use Arrow Keys to navigate time series');
console.log('   - Press Space to play/pause time series');
