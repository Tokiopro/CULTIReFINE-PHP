<?php
session_start();
require_once __DIR__ . '/line-auth/url-helper.php';

// LINE認証チェック
if (!isset($_SESSION['line_user_id'])) {
    header('Location: ' . getRedirectUrl('/reserve/line-auth/'));
    exit;
}

// フォーム送信処理
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_once 'line-auth/config.php';
    require_once 'line-auth/ExternalApi.php';
    require_once 'line-auth/logger.php';
    
    $logger = new Logger();
    $externalApi = new ExternalApi();
    
    // 入力データの検証
    $lastName = trim($_POST['last_name'] ?? '');
    $firstName = trim($_POST['first_name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? '');
    
    $errors = [];
    
    if (empty($lastName)) {
        $errors[] = '姓を入力してください。';
    }
    
    if (empty($firstName)) {
        $errors[] = '名を入力してください。';
    }
    
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $errors[] = '有効なメールアドレスを入力してください。';
    }
    
    if (empty($phone) || !preg_match('/^[0-9\-]+$/', $phone)) {
        $errors[] = '有効な電話番号を入力してください。';
    }
    
    if (empty($errors)) {
        // 新規ユーザー登録
        $userData = [
            'line_user_id' => $_SESSION['line_user_id'],
            'last_name' => $lastName,
            'first_name' => $firstName,
            'name' => $lastName . ' ' . $firstName, // 互換性のため
            'email' => $email,
            'phone' => $phone,
            'line_display_name' => $_SESSION['line_display_name'],
            'line_picture_url' => $_SESSION['line_picture_url'] ?? null
        ];
        
        try {
            $result = $externalApi->createUser($userData);
            
            if ($result) {
                $_SESSION['user_data'] = $result;
                $_SESSION['success_message'] = '登録が完了しました。';
                $logger->info('新規ユーザー登録完了', ['line_user_id' => $_SESSION['line_user_id']]);
                header('Location: ' . getRedirectUrl('/reserve/'));
                exit;
            } else {
                $errors[] = '登録に失敗しました。もう一度お試しください。';
            }
        } catch (Exception $e) {
            $logger->error('ユーザー登録エラー', ['error' => $e->getMessage()]);
            $errors[] = 'システムエラーが発生しました。';
        }
    }
}

$displayName = $_SESSION['line_display_name'] ?? '';
$pictureUrl = $_SESSION['line_picture_url'] ?? null;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>新規登録 - 天満病院 予約システム</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8">
            <div class="text-center">
                <h2 class="text-3xl font-extrabold text-gray-900">
                    新規登録
                </h2>
                <p class="mt-2 text-sm text-gray-600">
                    初めてご利用の方は、以下の情報をご登録ください
                </p>
            </div>
            
            <?php if (!empty($errors)): ?>
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <ul class="list-disc list-inside">
                        <?php foreach ($errors as $error): ?>
                            <li><?php echo htmlspecialchars($error); ?></li>
                        <?php endforeach; ?>
                    </ul>
                </div>
            <?php endif; ?>
            
            <div class="bg-white p-6 rounded-lg shadow-md">
                <?php if ($pictureUrl): ?>
                    <div class="flex justify-center mb-4">
                        <img src="<?php echo htmlspecialchars($pictureUrl); ?>" 
                             alt="プロフィール画像" 
                             class="w-20 h-20 rounded-full">
                    </div>
                <?php endif; ?>
                
                <p class="text-center mb-6">
                    LINEアカウント: <strong><?php echo htmlspecialchars($displayName); ?></strong>
                </p>
                
                <form method="POST" action="/reserve/registration.php" class="space-y-4">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label for="last_name" class="block text-sm font-medium text-gray-700">
                                姓 <span class="text-red-500">*</span>
                            </label>
                            <input type="text" 
                                   id="last_name" 
                                   name="last_name" 
                                   value="<?php echo htmlspecialchars($_POST['last_name'] ?? ''); ?>"
                                   placeholder="山田"
                                   required
                                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500">
                        </div>
                        <div>
                            <label for="first_name" class="block text-sm font-medium text-gray-700">
                                名 <span class="text-red-500">*</span>
                            </label>
                            <input type="text" 
                                   id="first_name" 
                                   name="first_name" 
                                   value="<?php echo htmlspecialchars($_POST['first_name'] ?? ''); ?>"
                                   placeholder="太郎"
                                   required
                                   class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500">
                        </div>
                    </div>
                    
                    <div>
                        <label for="email" class="block text-sm font-medium text-gray-700">
                            メールアドレス <span class="text-red-500">*</span>
                        </label>
                        <input type="email" 
                               id="email" 
                               name="email" 
                               value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>"
                               required
                               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500">
                    </div>
                    
                    <div>
                        <label for="phone" class="block text-sm font-medium text-gray-700">
                            電話番号 <span class="text-red-500">*</span>
                        </label>
                        <input type="tel" 
                               id="phone" 
                               name="phone" 
                               value="<?php echo htmlspecialchars($_POST['phone'] ?? ''); ?>"
                               placeholder="090-0000-0000"
                               required
                               class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500">
                    </div>
                    
                    <div class="pt-4">
                        <button type="submit" 
                                class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500">
                            登録する
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</body>
</html>