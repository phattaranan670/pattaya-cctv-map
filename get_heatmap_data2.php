<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// ข้อมูลการเชื่อมต่อ InfinityFree
$host = "sql101.infinityfree.com";
$username = "if0_40255240";
$password = "e0W3g1B5JokMM";
$dbname = "if0_40255240_heatmap";

// เชื่อมต่อฐานข้อมูล
$conn = new mysqli($host, $username, $password, $dbname);

// ตรวจสอบการเชื่อมต่อ
if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode([
        'success' => false, 
        'error' => 'Connection failed: ' . $conn->connect_error,
        'details' => 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'
    ]));
}

// Set charset เป็น UTF-8
$conn->set_charset("utf8mb4");

// รับพารามิเตอร์สำหรับกรองข้อมูล (ถ้ามี)
$camera_id = isset($_GET['camera_id']) ? $_GET['camera_id'] : null;
$start_date = isset($_GET['start_date']) ? $_GET['start_date'] : null;
$end_date = isset($_GET['end_date']) ? $_GET['end_date'] : null;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 1000;

// ตรวจสอบว่าตารางมีอยู่หรือไม่
$tableCheck = $conn->query("SHOW TABLES LIKE 'accident_detection'");
if ($tableCheck->num_rows == 0) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Table accident_detection does not exist',
        'details' => 'กรุณาสร้างตาราง accident_detection ก่อนใช้งาน',
        'solution' => 'ใช้ไฟล์ accident_detection.sql ใน phpMyAdmin'
    ]);
    $conn->close();
    exit;
}

// สร้าง SQL query แบบไดนามิก
$sql = "SELECT 
            id,
            camera_id,
            timestamp,
            lat,
            lon
        FROM accident_detection
        WHERE 1=1";

// เพิ่มเงื่อนไขการกรอง
$params = [];
$types = "";

if ($camera_id) {
    $sql .= " AND camera_id = ?";
    $params[] = $camera_id;
    $types .= "s";
}

if ($start_date) {
    $sql .= " AND timestamp >= ?";
    $params[] = $start_date;
    $types .= "s";
}

if ($end_date) {
    $sql .= " AND timestamp <= ?";
    $params[] = $end_date;
    $types .= "s";
}

$sql .= " ORDER BY timestamp DESC LIMIT ?";
$params[] = $limit;
$types .= "i";

// เตรียม statement
$stmt = $conn->prepare($sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Prepare failed: ' . $conn->error,
        'details' => 'เกิดข้อผิดพลาดในการเตรียม SQL query'
    ]);
    $conn->close();
    exit;
}

// Bind parameters ถ้ามี
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}

// Execute query
$stmt->execute();
$result = $stmt->get_result();

if (!$result) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Query execution failed: ' . $stmt->error,
        'details' => 'เกิดข้อผิดพลาดในการดึงข้อมูล'
    ]);
    $stmt->close();
    $conn->close();
    exit;
}

$data = [];
if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        $data[] = [
            'id' => (int)$row['id'],
            'camera_id' => $row['camera_id'],
            'timestamp' => $row['timestamp'],
            'lat' => (float)$row['lat'],
            'lon' => (float)$row['lon']
        ];
    }
}

// ส่งผลลัพธ์
echo json_encode([
    'success' => true,
    'data' => $data,
    'count' => count($data),
    'filters' => [
        'camera_id' => $camera_id,
        'start_date' => $start_date,
        'end_date' => $end_date,
        'limit' => $limit
    ],
    'timestamp' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

$stmt->close();
$conn->close();
?>
