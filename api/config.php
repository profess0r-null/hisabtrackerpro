<?php
$isHttps = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
ini_set('session.use_strict_mode', '1');
session_set_cookie_params(['httponly'=>true, 'secure'=>$isHttps, 'samesite'=>'Lax', 'path'=>'/']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
function jsonResponse($data, $status=200) {
 http_response_code($status); header('Content-Type: application/json'); header('Cache-Control: no-store'); echo json_encode($data); exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
 $csrf = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
 if (!is_string($csrf) || !hash_equals($_SESSION['csrf'], $csrf)) jsonResponse(['error'=>'Please reload and try again'],403);
 if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>5242880) jsonResponse(['error'=>'Request is too large'],413);
}
$host=getenv('HISAB_DB_HOST') ?: 'localhost';
$dbname=getenv('HISAB_DB_NAME') ?: 'hisabtracker';
$user=getenv('HISAB_DB_USER') ?: 'root';
$pass=getenv('HISAB_DB_PASSWORD') ?: '';
try {
 $pdo=new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4",$user,$pass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
} catch(PDOException $e) {error_log('HisabTracker database connection failed');jsonResponse(['error'=>'Database is unavailable. Please try again later.'],503);}
function throttleLogin() {
 $key=hash('sha256',$_SERVER['REMOTE_ADDR'] ?? 'unknown');$file=fopen(sys_get_temp_dir().DIRECTORY_SEPARATOR.'hisab-login-'.$key,'c+');
 if(!$file || !flock($file,LOCK_EX))jsonResponse(['error'=>'Please try again later'],503);
 $state=json_decode(stream_get_contents($file),true);$now=time();if(!$state || $now-($state['start']??0)>900)$state=['start'=>$now,'count'=>0];
 $state['count']++;ftruncate($file,0);rewind($file);fwrite($file,json_encode($state));flock($file,LOCK_UN);fclose($file);
 if($state['count']>20){header('Retry-After: 900');jsonResponse(['error'=>'Too many attempts. Try again in 15 minutes.'],429);}
}
