<?php
// ============================================
// 🗺️ Heatmap Data API for InfinityFree
// Fixed Version - ปรับปรุงแล้ว
// ============================================

// 🔧 ตั้งค่า CORS Headers (ต้องอยู่ก่อน echo อะไรออกมา)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ตั้งค่า Error Reporting สำหรับ Development (ปิดใน Production)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// =====================================================
// 📋 MySQL Database Configuration
// =====================================================
$host = "sql101.infinityfree.com";
$user = "if0_40255240";
$pass = "e0W3g1B5JokMM";
$dbname = "if0_40255240_heatmap";

// =====================================================
// 🌐 เชื่อมต่อฐานข้อมูล MySQL
// =====================================================
try {
    $conn = new mysqli($host, $user, $pass, $dbname);
    
    // ตรวจสอบการเชื่อมต่อ
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }
    
    // ตั้งค่า charset
    $conn->set_charset("utf8mb4");
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "เชื่อมต่อฐานข้อมูลไม่ได้",
        "message" => $e->getMessage(),
        "hint" => "ตรวจสอบ: 1) ชื่อ database ถูกต้องหรือไม่ 2) สร้าง database แล้วหรือยัง 3) username/password ถูกต้องหรือไม่",
        "timestamp" => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// =====================================================
// 📊 ตรวจสอบว่าตารางมีอยู่หรือไม่
// =====================================================
$check_table = "SHOW TABLES LIKE 'accident_data'";
$table_exists = $conn->query($check_table);

if (!$table_exists || $table_exists->num_rows == 0) {
    http_response_code(404);
    echo json_encode([
        "success" => false,
        "error" => "ไม่พบตาราง accident_data",
        "hint" => "กรุณารัน SQL สร้างตารางจากไฟล์ create_mysql_tables.sql ใน phpMyAdmin ก่อน",
        "database" => $dbname,
        "timestamp" => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $conn->close();
    exit;
}

// =====================================================
// 📊 ดึงข้อมูลจากตาราง
// =====================================================

// รับ limit จาก query string
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 1000;
$limit = max(1, min($limit, 10000)); // จำกัด 1-10000

// ✅ เพิ่ม severity ใน SELECT (ถ้ามี)
$query = "
    SELECT 
        id, 
        timestamp, 
        camera_id, 
        lat, 
        lon
    FROM accident_data 
    ORDER BY timestamp DESC
    LIMIT ?
";

// ใช้ Prepared Statement เพื่อความปลอดภัย
$stmt = $conn->prepare($query);

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "ไม่สามารถเตรียม query ได้",
        "message" => $conn->error,
        "timestamp" => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $conn->close();
    exit;
}

$stmt->bind_param("i", $limit);
$stmt->execute();
$result = $stmt->get_result();

// ถ้าดึงข้อมูลไม่ได้
if (!$result) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "ไม่สามารถดึงข้อมูลจากตารางได้",
        "message" => $conn->error,
        "timestamp" => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $stmt->close();
    $conn->close();
    exit;
}

// =====================================================
// 🔄 แปลงผลลัพธ์เป็น JSON Array
// =====================================================
$data = [];
$row_count = 0;

while ($row = $result->fetch_assoc()) {
    // ตรวจสอบว่าค่า lat/lon ถูกต้อง
    $lat = floatval($row["lat"]);
    $lon = floatval($row["lon"]);
    
    // ข้าม record ที่มีพิกัด 0,0 หรือ invalid
    if ($lat == 0 || $lon == 0 || abs($lat) > 90 || abs($lon) > 180) {
        continue;
    }
    
    // คำนวณน้ำหนักสำหรับ heatmap (default = 1.0)
    $weight = 1.0;
    
    // ถ้ามี severity column ให้ใช้ค่านี้
    if (isset($row["severity"])) {
        switch (strtolower($row["severity"])) {
            case 'low':
                $weight = 0.5;
                break;
            case 'medium':
                $weight = 1.0;
                break;
            case 'high':
                $weight = 2.0;
                break;
            default:
                $weight = 1.0;
        }
    }
    
    // ✅ แก้ไข: เพิ่มวงเล็บปิดอย่างถูกต้อง
    $data[] = [
        "id" => intval($row["id"]),
        "timestamp" => $row["timestamp"],
        "camera_id" => $row["camera_id"],
        "lat" => $lat,
        "lng" => $lon,
        "lon" => $lon,
        "latitude" => $lat,
        "longitude" => $lon,
        "weight" => $weight
    ];
    
    $row_count++;
}

// =====================================================
// 📤 ส่งข้อมูลออกเป็น JSON
// =====================================================
$response = [
    "success" => true,
    "count" => $row_count,
    "database" => $dbname,
    "limit" => $limit,
    "timestamp" => date('Y-m-d H:i:s'),
    "data" => $data
];

// ถ้าไม่มีข้อมูล ให้เตือน
if ($row_count == 0) {
    $response["warning"] = "ไม่พบข้อมูลในตาราง accident_data หรือข้อมูลทั้งหมดมีพิกัดไม่ถูกต้อง";
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

// ปิดการเชื่อมต่อ
$stmt->close();
$conn->close();
?>