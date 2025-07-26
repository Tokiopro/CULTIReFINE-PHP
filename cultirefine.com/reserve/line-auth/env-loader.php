<?php

/**
 * 簡易的な.envファイルローダー
 */
class EnvLoader
{
    public static function load(string $path): void
    {
        if (!file_exists($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // コメント行をスキップ
            if (strpos(trim($line), '#') === 0) {
                continue;
            }

            // KEY=VALUE形式をパース
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $key = trim($parts[0]);
            $value = trim($parts[1]);

            // クォートを除去
            $value = trim($value, '"\'');

            // 環境変数として設定
            putenv("{$key}={$value}");
            $_ENV[$key] = $value;
        }
    }
}