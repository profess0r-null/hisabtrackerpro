<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    if(!is_array($input))jsonResponse(['error'=>'Invalid request'],400);
    foreach(['email','password'] as $key)if(isset($input[$key])&&!is_string($input[$key]))jsonResponse(['error'=>'Invalid request'],400);
    
    if ($action === 'register') {
        throttleLogin();
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($password) || empty($password)) {
            jsonResponse(['error' => 'Email and password are required'], 400);
        }
        if (strlen($password) < 6) {
            jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        try {
            $stmt = $pdo->prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)");
            $stmt->execute([$email, $hash]);
            $userId = $pdo->lastInsertId();
            
            // Auto login after register
            session_regenerate_id(true);
            $_SESSION['csrf']=bin2hex(random_bytes(32));
            $_SESSION['user_id'] = $userId;
            $_SESSION['email'] = $email;
            
            jsonResponse(['success' => true, 'csrf'=>$_SESSION['csrf'], 'user' => ['id' => $userId, 'email' => $email]]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // Integrity constraint violation (duplicate email)
                jsonResponse(['error' => 'User already exists'], 400);
            }
            jsonResponse(['error' => 'Registration failed'], 500);
        }
    }
    
    if ($action === 'login') {
        throttleLogin();
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        
        $stmt = $pdo->prepare("SELECT id, password_hash FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if ($user && password_verify($password, $user['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['csrf']=bin2hex(random_bytes(32));
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['email'] = $email;
            jsonResponse(['success' => true, 'csrf'=>$_SESSION['csrf'], 'user' => ['id' => $user['id'], 'email' => $email]]);
        } else {
            jsonResponse(['error' => 'Invalid email or password'], 401);
        }
    }
    
    if ($action === 'logout') {
        $_SESSION=[];
        session_destroy();
        jsonResponse(['success' => true]);
    }
    
    if ($action === 'update_password') {
        if (!isset($_SESSION['user_id'])) {
            jsonResponse(['error' => 'Unauthorized'], 401);
        }
        
        $newPassword = $input['password'] ?? '';
        if (strlen($newPassword) < 6) {
            jsonResponse(['error' => 'Password must be at least 6 characters'], 400);
        }
        
        $hash = password_hash($newPassword, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $stmt->execute([$hash, $_SESSION['user_id']]);
        
        jsonResponse(['success' => true]);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'session') {
        if (isset($_SESSION['user_id'])) {
            jsonResponse(['csrf'=>$_SESSION['csrf'],'user' => ['id' => $_SESSION['user_id'], 'email' => $_SESSION['email']]]);
        } else {
            jsonResponse(['csrf'=>$_SESSION['csrf'],'user' => null]);
        }
    }
}

jsonResponse(['error' => 'Invalid action'], 400);
?>
