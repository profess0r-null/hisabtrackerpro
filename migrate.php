<?php
// Migration uploads are disabled on all web requests. Keep exports outside the document root.
if (PHP_SAPI !== 'cli') { http_response_code(410); exit('Migration tool is disabled.'); }
require_once 'api/config.php';

// One-time security measure: You can add a hardcoded password here if hosting live
// define('MIGRATE_PASS', 'mysecret'); 
// if($_POST['pass'] !== MIGRATE_PASS) die('Unauthorized');

$message = '';

if (isset($_POST['upload'])) {
    try {
        $pdo->beginTransaction();
        
        $uuid_to_id = [];
        
        // 1. Process auth.users
        if (!empty($_FILES['auth_users']['tmp_name'])) {
            if (($handle = fopen($_FILES['auth_users']['tmp_name'], "r")) !== FALSE) {
                $header = fgetcsv($handle);
                $idIdx = array_search('id', $header);
                $emailIdx = array_search('email', $header);
                $passIdx = array_search('encrypted_password', $header);
                
                if ($idIdx === false || $emailIdx === false || $passIdx === false) {
                    throw new Exception("auth.users CSV is missing required columns (id, email, encrypted_password).");
                }

                $stmt = $pdo->prepare("INSERT IGNORE INTO users (email, password_hash) VALUES (?, ?)");
                $getStmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
                
                $count = 0;
                while (($data = fgetcsv($handle)) !== FALSE) {
                    $uuid = $data[$idIdx];
                    $email = $data[$emailIdx];
                    $hash = $data[$passIdx];
                    
                    if (empty($email) || empty($hash)) continue;
                    
                    // Supabase uses bcrypt for password hashes which PHP natively understands.
                    $stmt->execute([$email, $hash]);
                    
                    // Get the newly inserted ID or existing ID
                    $getStmt->execute([$email]);
                    $newId = $getStmt->fetchColumn();
                    $uuid_to_id[$uuid] = $newId;
                    $count++;
                }
                fclose($handle);
                $message .= "✅ $count Users imported successfully.<br>";
            }
        }

        // 2. Process hisab_users (Hisab data)
        if (!empty($_FILES['hisab_users']['tmp_name'])) {
            if (($handle = fopen($_FILES['hisab_users']['tmp_name'], "r")) !== FALSE) {
                $header = fgetcsv($handle);
                $idIdx = array_search('id', $header);
                $dataIdx = array_search('data', $header);
                
                $stmt = $pdo->prepare("INSERT INTO user_data (user_id, type, data_blob) VALUES (?, 'hisab', ?) ON DUPLICATE KEY UPDATE data_blob = VALUES(data_blob)");
                
                $count = 0;
                while (($data = fgetcsv($handle)) !== FALSE) {
                    $uuid = $data[$idIdx];
                    $dataBlob = $data[$dataIdx];
                    
                    if (isset($uuid_to_id[$uuid])) {
                        $stmt->execute([$uuid_to_id[$uuid], $dataBlob]);
                        $count++;
                    }
                }
                fclose($handle);
                $message .= "✅ $count Hisab Data rows imported successfully.<br>";
            }
        }

        // 3. Process hisab_cash (Cash data)
        if (!empty($_FILES['hisab_cash']['tmp_name'])) {
            if (($handle = fopen($_FILES['hisab_cash']['tmp_name'], "r")) !== FALSE) {
                $header = fgetcsv($handle);
                $idIdx = array_search('id', $header);
                $dataIdx = array_search('data', $header);
                
                $stmt = $pdo->prepare("INSERT INTO user_data (user_id, type, data_blob) VALUES (?, 'cash', ?) ON DUPLICATE KEY UPDATE data_blob = VALUES(data_blob)");
                
                $count = 0;
                while (($data = fgetcsv($handle)) !== FALSE) {
                    $uuid = $data[$idIdx];
                    $dataBlob = $data[$dataIdx];
                    
                    if (isset($uuid_to_id[$uuid])) {
                        $stmt->execute([$uuid_to_id[$uuid], $dataBlob]);
                        $count++;
                    }
                }
                fclose($handle);
                $message .= "✅ $count Cash Data rows imported successfully.<br>";
            }
        }

        $pdo->commit();
        $message .= "<strong style='color:green'>Migration Completed Successfully!</strong>";
    } catch (Exception $e) {
        $pdo->rollBack();
        $message = "<strong style='color:red'>Error: " . $e->getMessage() . "</strong>";
    }
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HisabTracker Supabase Migration</title>
    <style>
        body { font-family: sans-serif; background: #141929; color: #fff; padding: 20px; }
        .box { background: #1f273b; padding: 20px; border-radius: 10px; max-width: 600px; margin: auto; }
        input[type="file"] { display: block; margin: 10px 0 20px 0; }
        button { background: #3b82f6; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; }
        .msg { margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>🚀 Supabase to cPanel Migration</h2>
        <p>Upload your exported CSV files from Supabase to migrate users and their data.</p>
        
        <?php if($message): ?>
            <div class="msg"><?= $message ?></div>
        <?php endif; ?>

        <form method="POST" enctype="multipart/form-data">
            <label>1. auth.users (CSV)</label>
            <input type="file" name="auth_users" accept=".csv" required>
            <small style="color:#aaa; display:block; margin-top:-15px; margin-bottom:15px;">Required columns: id, email, encrypted_password</small>
            
            <label>2. hisab_users (CSV)</label>
            <input type="file" name="hisab_users" accept=".csv">
            <small style="color:#aaa; display:block; margin-top:-15px; margin-bottom:15px;">Required columns: id, data</small>

            <label>3. hisab_cash (CSV)</label>
            <input type="file" name="hisab_cash" accept=".csv">
            <small style="color:#aaa; display:block; margin-top:-15px; margin-bottom:15px;">Required columns: id, data</small>

            <button type="submit" name="upload">Run Migration</button>
        </form>
    </div>
</body>
</html>
