<?php
// rf.php — Proxy ไป Roboflow (Serverless) ด้วย Private Key

// ====== ตั้ง Origin ที่อนุญาต ======
$whitelist = [
  'http://localhost',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'https://pattaya-cctv-kku.infinityfreeapp.com',
  'null' // กรณีเปิดไฟล์แบบ file://
];
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'null';
if (in_array($origin, $whitelist, true)) {
  header("Access-Control-Allow-Origin: $origin");
} else {
  // ปลอดภัยไว้ก่อน: ไม่อนุญาต origin แปลก
  header("Access-Control-Allow-Origin: https://pattaya-cctv-kku.infinityfreeapp.com");
}
header("Vary: Origin");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Cache-Control: no-store");

// preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ====== ใส่ PRIVATE KEY ของ Roboflow (workspace เดียวกับโปรเจกต์) ======
$PRIVATE = 'evLVrAROGlWWdQOMUPaz';

if (!$PRIVATE) { http_response_code(500); echo json_encode(['error'=>'Missing RF_PRIVATE_KEY']); exit; }

// รับอินพุต (JSON หรือ form)
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data) { $data = $_POST; }

$model       = isset($data['model']) ? $data['model'] : 'detection-accident-yb0lz-g9hc9/1';
$confidence  = isset($data['confidence']) ? $data['confidence'] : 0.6;
$overlap     = isset($data['overlap']) ? $data['overlap'] : 0.3;
$imageBase64 = isset($data['imageBase64']) ? $data['imageBase64'] : null;

// health check แบบง่าย
if (isset($_GET['health'])) { header('Content-Type: application/json'); echo json_encode(['ok'=>true]); exit; }

if (!$imageBase64) {
  http_response_code(400);
  header('Content-Type: application/json');
  echo json_encode(['error' => 'imageBase64 required']);
  exit;
}

// เรียก Roboflow Serverless
$url = "https://serverless.roboflow.com/$model"
     . "?api_key=$PRIVATE&format=json"
     . "&confidence=$confidence&overlap=$overlap";

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
  CURLOPT_POSTFIELDS => 'image=' . rawurlencode($imageBase64),
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HEADER => true,
  CURLOPT_TIMEOUT => 25
]);
$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$hsize    = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$body     = substr($response, $hsize);
curl_close($ch);

http_response_code($status);
header('Content-Type: application/json');
echo $body;
