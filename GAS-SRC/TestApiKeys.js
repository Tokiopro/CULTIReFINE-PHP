/**
 * APIキー設定確認用テスト関数
 * 現在のスクリプトプロパティに設定されているAPIキーを確認
 */
function testApiKeySettings() {
  console.log('=== APIキー設定確認 ===');
  
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // 各種APIキー設定を確認
  const keyProperties = [
    'PHP_API_KEYS',
    'API_TOKENS',
    'ALLOWED_API_KEYS',
    'DEFAULT_API_KEY',
    'LINE_MESSAGING_CHANNEL_ACCESS_TOKEN'
  ];
  
  keyProperties.forEach(prop => {
    const value = scriptProperties.getProperty(prop);
    if (value) {
      console.log(`${prop}: "${value}"`);
      if (prop === 'PHP_API_KEYS' || prop === 'API_TOKENS' || prop === 'ALLOWED_API_KEYS') {
        const tokens = value.split(',').map(t => t.trim());
        console.log(`  -> 分割後: ${JSON.stringify(tokens)}`);
        console.log(`  -> トークン数: ${tokens.length}`);
        tokens.forEach((token, index) => {
          console.log(`  -> [${index}]: "${token}" (長さ: ${token.length})`);
        });
      }
    } else {
      console.log(`${prop}: (未設定)`);
    }
    console.log('---');
  });
  
  // php_api_key_123が含まれているか確認
  console.log('\n=== php_api_key_123 の存在確認 ===');
  const targetKey = 'php_api_key_123';
  let found = false;
  
  keyProperties.forEach(prop => {
    const value = scriptProperties.getProperty(prop);
    if (value) {
      const tokens = value.split(',').map(t => t.trim());
      if (tokens.includes(targetKey)) {
        console.log(`✓ ${prop} に "${targetKey}" が含まれています`);
        found = true;
      } else {
        console.log(`✗ ${prop} に "${targetKey}" は含まれていません`);
      }
    }
  });
  
  if (!found) {
    console.log('\n⚠️ "php_api_key_123" はどのプロパティにも設定されていません');
  }
  
  console.log('\n=== テスト完了 ===');
}

/**
 * APIキーを手動で設定する関数（必要に応じて使用）
 */
function setApiKeys() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // PHP_API_KEYSに php_api_key_123 を追加
  const currentKeys = scriptProperties.getProperty('PHP_API_KEYS') || '';
  const keysArray = currentKeys ? currentKeys.split(',').map(t => t.trim()) : [];
  
  if (!keysArray.includes('php_api_key_123')) {
    keysArray.push('php_api_key_123');
    scriptProperties.setProperty('PHP_API_KEYS', keysArray.join(','));
    console.log('php_api_key_123 を PHP_API_KEYS に追加しました');
  } else {
    console.log('php_api_key_123 は既に PHP_API_KEYS に存在します');
  }
}

/**
 * 認証テスト用の関数
 */
function testAuthentication() {
  console.log('=== 認証テスト ===');
  
  // テストケース1: Bearer token with php_api_key_123
  const e1 = {
    parameter: {
      Authorization: 'Bearer php_api_key_123',
      path: '/api/v1/patients/123'
    }
  };
  
  console.log('Test 1: Bearer php_api_key_123');
  console.log('認証結果:', AuthMiddleware.authenticate(e1));
  
  // トークン検証を直接テスト
  console.log('\n直接トークン検証テスト:');
  console.log('validateBearerToken("php_api_key_123"):', AuthMiddleware.validateBearerToken('php_api_key_123'));
  
  console.log('\n=== テスト完了 ===');
}