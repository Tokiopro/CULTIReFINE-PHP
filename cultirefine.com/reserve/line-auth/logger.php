<?php

class Logger
{
    private $logFile;
    
    public function __construct()
    {
        $this->logFile = __DIR__ . '/logs/app.log';
        $this->ensureLogDirectory();
    }
    
    private function ensureLogDirectory()
    {
        $logDir = dirname($this->logFile);
        if (!is_dir($logDir)) {
            if (!@mkdir($logDir, 0755, true)) {
                // ログディレクトリ作成に失敗した場合、システムの一時ディレクトリを使用
                $this->logFile = sys_get_temp_dir() . '/tenma_hospital_app.log';
            }
        }
        
        // ログファイルの書き込み権限をチェック
        if (!is_writable(dirname($this->logFile))) {
            // 書き込み権限がない場合も一時ディレクトリを使用
            $this->logFile = sys_get_temp_dir() . '/tenma_hospital_app.log';
        }
    }
    
    public function log($level, $message, $context = array())
    {
        // DEBUG_MODEが未定義の場合はfalseとして扱う
        $debugMode = defined('DEBUG_MODE') ? DEBUG_MODE : false;
        if (!$debugMode && $level === 'debug') {
            return;
        }
        
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = sprintf(
            "[%s] %s: %s",
            $timestamp,
            strtoupper($level),
            $message
        );
        
        if (!empty($context)) {
            $logEntry .= ' ' . json_encode($context, JSON_UNESCAPED_UNICODE);
        }
        
        $logEntry .= PHP_EOL;
        
        @file_put_contents($this->logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }
    
    public function error($message, $context = array())
    {
        $this->log('error', $message, $context);
    }
    
    public function warning($message, $context = array())
    {
        $this->log('warning', $message, $context);
    }
    
    public function info($message, $context = array())
    {
        $this->log('info', $message, $context);
    }
    
    public function debug($message, $context = array())
    {
        $this->log('debug', $message, $context);
    }
}