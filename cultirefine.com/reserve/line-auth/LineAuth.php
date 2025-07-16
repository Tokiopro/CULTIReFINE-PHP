<?php

class LineAuth
{
    private const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
    private const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
    private const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';
    
    /**
     * LINE認証URLを生成
     */
    public function getAuthorizationUrl(string $state): string
    {
        $params = [
            'response_type' => 'code',
            'client_id' => LINE_CHANNEL_ID,
            'redirect_uri' => LINE_CALLBACK_URL,
            'state' => $state,
            'scope' => 'profile openid',
            'nonce' => bin2hex(random_bytes(16))
        ];
        
        return self::LINE_AUTH_URL . '?' . http_build_query($params);
    }
    
    /**
     * 認証コードからアクセストークンを取得
     */
    public function getAccessToken(string $code): ?array
    {
        $params = [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => LINE_CALLBACK_URL,
            'client_id' => LINE_CHANNEL_ID,
            'client_secret' => LINE_CHANNEL_SECRET
        ];
        
        $ch = curl_init(self::LINE_TOKEN_URL);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            if (DEBUG_MODE) {
                error_log('LINE Token Error: ' . $response);
            }
            return null;
        }
        
        return json_decode($response, true);
    }
    
    /**
     * アクセストークンからユーザープロフィールを取得
     */
    public function getUserProfile(string $accessToken): ?array
    {
        $ch = curl_init(self::LINE_PROFILE_URL);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            if (DEBUG_MODE) {
                error_log('LINE Profile Error: ' . $response);
            }
            return null;
        }
        
        return json_decode($response, true);
    }
}