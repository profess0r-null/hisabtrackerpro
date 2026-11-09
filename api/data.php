<?php
require_once 'config.php';

if (!isset($_SESSION['user_id'])) {
    jsonResponse(['error' => 'Unauthorized'], 401);
}

$userId = $_SESSION['user_id'];
$action = $_GET['action'] ?? '';
$type = $_GET['type'] ?? 'hisab';
if(!in_array($type,['hisab','cash'],true))jsonResponse(['error'=>'Invalid account type'],400);
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get') {
    $stmt = $pdo->prepare("SELECT data_blob FROM user_data WHERE user_id = ? AND type = ?");
    $stmt->execute([$userId, $type]);
    $row = $stmt->fetch();
    
    if ($row && $row['data_blob']) {
        // Return raw JSON text from DB directly
        header('Content-Type: application/json');
        echo $row['data_blob'];
        exit;
    } else {
        // Empty data structure
        jsonResponse(['data' => null]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'save') {
    $input = file_get_contents('php://input');
    
    // Quick validation to ensure it's valid JSON
    if (json_decode($input) === null && json_last_error() !== JSON_ERROR_NONE) {
         jsonResponse(['error' => 'Invalid JSON data'], 400);
    }
    
    $decoded=json_decode($input,true);
    if(!is_array($decoded)||array_is_list($decoded))jsonResponse(['error'=>'Account data must be an object'],400);
    if(!isset($decoded['profilesData']) && ($type==='hisab' ? (!isset($decoded['receive'],$decoded['give']) || !is_array($decoded['receive']) || !is_array($decoded['give'])) : (!isset($decoded['history']) || !is_array($decoded['history']))))jsonResponse(['error'=>'Invalid account structure'],400);
    $stmt = $pdo->prepare("INSERT INTO user_data (user_id, type, data_blob) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data_blob = VALUES(data_blob)");
    $stmt->execute([$userId, $type, $input]);
    
    jsonResponse(['success' => true]);
}

jsonResponse(['error' => 'Invalid action'], 400);
?>
