<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://phattaranan670.github.io'); 
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// ----------------------
// 1️⃣ เชื่อมต่อฐานข้อมูล PostgreSQL
// ----------------------
$host = "localhost";
$port = "5432";
$dbname = "RESEARCH_DETECTION";   // 🔹 แก้ชื่อฐานข้อมูลตามจริง
$user = "postgres";        // 🔹 แก้ชื่อผู้ใช้
$pass = "postgres";          // 🔹 แก้รหัสผ่าน

$conn = pg_connect("host=$host port=$port dbname=$dbname user=$user password=$pass");

// ถ้าเชื่อมต่อไม่ได้
if (!$conn) {
    echo json_encode(["error" => "เชื่อมต่อฐานข้อมูลไม่ได้"]);
    exit;
}

// ----------------------
// 2️⃣ ดึงข้อมูลจากตาราง accident_detection
// ----------------------
$query = "SELECT id, timestamp, camera_id, lat, long, ST_AsGeoJSON(geom) AS geom_json FROM accident_detection";
$result = pg_query($conn, $query);

// ถ้าดึงข้อมูลไม่ได้
if (!$result) {
    echo json_encode(["error" => "ไม่สามารถดึงข้อมูลจากตารางได้"]);
    exit;
}

// ----------------------
// 3️⃣ แปลงผลลัพธ์เป็น JSON Array
// ----------------------
$data = [];
while ($row = pg_fetch_assoc($result)) {
    $data[] = [
        "id" => (int)$row["id"],
        "timestamp" => $row["timestamp"],
        "camera_id" => $row["camera_id"],
        "lat" => (float)$row["lat"],
        "long" => (float)$row["long"],
        "geom" => json_decode($row["geom_json"], true) // 🔹 แปลง geometry เป็น GeoJSON object
    ];
}

// ----------------------
// 4️⃣ ส่งข้อมูลออกเป็น JSON
// ----------------------
echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

pg_close($conn);
?>
