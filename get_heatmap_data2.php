<?php
// ============================================
// 🗺️ Heatmap Data API for InfinityFree
// ใช้กับ MySQL Database บน VistaPanel
// ============================================

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://phattaranan670.github.io'); 
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// =====================================================
// 📋 MySQL Database Configuration
// ⚠️ ข้อมูลจาก VistaPanel ของคุณ
// =====================================================
$host = "sql309.infinityfree.com";     // ✅ MySQL Hostname
$user = "if0_40240291";                // ✅ MySQL Username
$pass = "bIL1YX6iQxv";                 // ✅ MySQL Password
$dbname = "if0_40240291_postgres";    // ⚠️ แก้เป็นชื่อ MySQL Database ที่สร้างจริง

// ⚠️ ถ้าคุณยังใช้ชื่อ database เดิม แก้เป็น:
// $dbname = "if0_40240291_postgres";  // แต่นี่คือ MySQL ไม่ใช่ PostgreSQL นะ

// =====================================================
// 🌐 เชื่อมต่อฐานข้อมูล MySQL
// =====================================================
$conn = new mysqli($host, $user, $pass, $dbname);

// ตรวจสอบการเชื่อมต่อ
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "เชื่อมต่อฐานข้อมูลไม่ได้",
        "message" => $conn->connect_error,
        "hint" => "ตรวจสอบ: 1) ชื่อ database ถูกต้องหรือไม่ 2) สร้าง database แล้วหรือยัง 3) username/password ถูกต้องหรือไม่"
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// ตั้งค่า charset
$conn->set_charset("utf8mb4");

// =====================================================
// 📊 ดึงข้อมูลจากตาราง
// =====================================================

// ตรวจสอบว่าตารางมีอยู่หรือไม่
$check_table = "SHOW TABLES LIKE 'accident_data'";
$table_exists = $conn->query($check_table);

if ($table_exists->num_rows == 0) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "ไม่พบตาราง accident_data",
        "hint" => "กรุณารัน SQL สร้างตารางจากไฟล์ create_mysql_tables.sql ใน phpMyAdmin ก่อน",
        "database" => $dbname
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $conn->close();
    exit;
}

// ดึงข้อมูล
$query = "
    SELECT 
        id, 
        timestamp, 
        camera_id, 
        lat, 
        lon,
        severity,
        status,
        description
    FROM accident_data 
    ORDER BY timestamp DESC
    LIMIT 1000
";

$result = $conn->query($query);

// ถ้าดึงข้อมูลไม่ได้
if (!$result) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "ไม่สามารถดึงข้อมูลจากตารางได้",
        "message" => $conn->error,
        "query" => $query
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $conn->close();
    exit;
}

// =====================================================
// 🔄 แปลงผลลัพธ์เป็น JSON Array
// =====================================================
$data = [];
while ($row = $result->fetch_assoc()) {
    // คำนวณน้ำหนักสำหรับ heatmap
    $weight = 1.0;
    if (isset($row["severity"])) {
        switch ($row["severity"]) {
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
    
    $data[] = [
        "id" => (int)$row["id"],
        "timestamp" => $row["timestamp"],
        "camera_id" => $row["camera_id"],
        "lat" => (float)$row["lat"],
        "lng" => (float)$row["lon"],     // ใช้ lng สำหรับ Leaflet
        "long" => (float)$row["lon"],    // ใช้ long สำหรับ backward compatibility
        "weight" => $weight,              // น้ำหนักสำหรับ heatmap
        "severity" => $row["severity"] ?? "medium",
        "status" => $row["status"] ?? "pending",
        "description" => $row["description"] ?? ""
    ];
}

// =====================================================
// 📤 ส่งข้อมูลออกเป็น JSON
// =====================================================
echo json_encode([
    "success" => true,
    "count" => count($data),
    "database" => $dbname,
    "data" => $data
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

$conn->close();

?>
