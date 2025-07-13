<?php
session_start();

// セッションを破棄
session_destroy();

// LINEアプリに戻るか、ログインページにリダイレクト
header('Location: /reserve/line-auth/');
exit;