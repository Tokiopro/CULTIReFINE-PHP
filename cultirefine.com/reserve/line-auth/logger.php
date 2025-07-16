<?php

class Logger
{
    private string $logFile;
    
    public function __construct()
    {
        $this->logFile = __DIR__ . '/logs/app.log';
        $this->ensureLogDirectory();
    }
    
    private function ensureLogDirectory(): void
    {
        $logDir = dirname($this->logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
    }
    
    public function log(string $level, string $message, array $context = []): void
    {
        if (!DEBUG_MODE && $level === 'debug') {
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
        
        file_put_contents($this->logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }
    
    public function error(string $message, array $context = []): void
    {
        $this->log('error', $message, $context);
    }
    
    public function warning(string $message, array $context = []): void
    {
        $this->log('warning', $message, $context);
    }
    
    public function info(string $message, array $context = []): void
    {
        $this->log('info', $message, $context);
    }
    
    public function debug(string $message, array $context = []): void
    {
        $this->log('debug', $message, $context);
    }
}