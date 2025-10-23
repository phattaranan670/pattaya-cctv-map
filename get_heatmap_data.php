<?php
// ข้อมูลการเชื่อมต่อฐานข้อมูล
$host = "localhost";
$port = "5432";
$dbname = "RESEARCH_DETECTION"; // 🚨 แก้ไข: ใช้ชื่อฐานข้อมูลที่ถูกต้องจากไฟล์ SQL
$user = "postgres";      
$password = "postgres"; // 🚨 **เปลี่ยนเป็นรหัสผ่านจริง** ของคุณ

try {
    // เชื่อมต่อด้วย PDO
    $dsn = "pgsql:host=$host;port=$port;dbname=$dbname";
    $pdo = new PDO($dsn, $user, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // ดึงข้อมูลพิกัดและความรุนแรง
    // 🎯 แก้ไข: ใช้คอลัมน์ 'lat', 'long' และใช้ '1 AS weight' แทน 'severity_level' 
    // เพื่อหลีกเลี่ยงข้อผิดพลาดเรื่องคอลัมน์ที่ไม่มีอยู่จริง
    $sql = "SELECT lat, long, 1 AS weight FROM accident_data"; 
    $stmt = $pdo->query($sql);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // จัดโครงสร้างข้อมูลสำหรับ Heatmap
    $heatmap_data = [];
    foreach ($results as $row) {
        $heatmap_data[] = [
            'lat' => (float)$row['lat'],      
            'lng' => (float)$row['long'],     
            'weight' => (int)$row['weight'] // ดึงค่าจาก 1 AS weight
        ];
    }

    // ส่งออกเป็น JSON
    header('Content-Type: application/json');
    echo json_encode($heatmap_data);

} catch (PDOException $e) {
    // จัดการข้อผิดพลาด
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
}
?>