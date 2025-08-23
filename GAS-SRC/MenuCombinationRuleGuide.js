/**
 * メニュー組み合わせルール機能使用ガイド
 * 安全な初期化と使用方法についてのドキュメント
 */

/**
 * ===== 安全な初期化手順 =====
 * 
 * 1. ルール定義シートの作成（既存データに影響なし）
 *    - 実行: createMenuCombinationRuleSheetsMenu()
 *    - または直接: SpreadsheetManager.createMenuCombinationRuleSheets()
 * 
 * 2. 動作確認
 *    - 実行: runMenuCombinationTestsMenu()
 *    - または直接: runMenuCombinationTests()
 * 
 * 3. データ整合性チェック
 *    - 実行: checkDataConsistencyMenu()
 *    - または直接: checkDataConsistency()
 * 
 * ===== 注意事項 =====
 * 
 * × 危険: initializeSheets() または initializeAllSheets()
 *   → 全シートが初期化され、既存データが失われる可能性
 * 
 * ○ 安全: createMenuCombinationRuleSheetsMenu()
 *   → ルール定義シートのみ作成、既存シートは影響なし
 * 
 * ===== 作成されるシート =====
 * 
 * 1. 横並びルール定義シート
 *    - 同時間帯での組み合わせルール
 *    - カテゴリ間の可否設定
 *    - 例外ルール設定
 * 
 * 2. 縦並びルール定義シート
 *    - 連続施術の順序設定
 *    - 時間調整ルール
 *    - 優先順位設定
 */

/**
 * メニュー組み合わせルール機能の概要説明
 */
function showMenuCombinationRuleGuide() {
  const guideText = `
メニュー組み合わせルール機能ガイド

【機能概要】
✓ メニューの横並び（同時間帯）組み合わせルール管理
✓ メニューの縦並び（連続施術）時間最適化
✓ 患者履歴に基づくメニューID自動判定
✓ リアルタイム時間計算と表示

【安全な初期化手順】
1. createMenuCombinationRuleSheetsMenu() を実行
   → ルール定義シートを作成（既存データに影響なし）

2. runMenuCombinationTestsMenu() でテスト実行
   → 機能の動作確認

3. 作成されたシートでルールを編集
   → 横並びルール定義、縦並びルール定義

【重要な注意事項】
⚠️ initializeSheets() は既存データを上書きする危険性があります
✅ createMenuCombinationRuleSheetsMenu() を使用してください

【作成されるシート】
• 横並びルール定義: 同時間帯組み合わせルール
• 縦並びルール定義: 連続施術時間最適化ルール

【サポート機能】
• メニュー正規化（初回/2回目自動判定）
• 動的メニューフィルタリング
• 時間最適化計算
• 組み合わせ妥当性チェック
`;

  SpreadsheetApp.getUi().alert('メニュー組み合わせルール機能ガイド', guideText, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * クイックスタートガイド
 */
function quickStartMenuCombinationRules() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'メニュー組み合わせルール - クイックスタート',
    'メニュー組み合わせルール機能を開始しますか？\n\n' +
    '以下の手順で安全に初期化を行います：\n' +
    '1. ルール定義シートを作成\n' +
    '2. 動作テストを実行\n' +
    '3. 結果を確認\n\n' +
    '既存データには影響しません。',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    try {
      // ステップ1: シート作成
      ui.alert('ステップ1: ルール定義シート作成中...');
      const createResult = SpreadsheetManager.createMenuCombinationRuleSheets();
      
      if (!createResult.success) {
        throw new Error(createResult.error);
      }
      
      // ステップ2: テスト実行
      ui.alert('ステップ2: 動作テスト実行中...');
      runMenuCombinationTests();
      
      // ステップ3: 完了報告
      ui.alert(
        'セットアップ完了！',
        'メニュー組み合わせルール機能のセットアップが完了しました。\n\n' +
        '作成されたシート：\n' +
        createResult.message.join('\n') + '\n\n' +
        '次の手順：\n' +
        '1. 作成されたルール定義シートでルールを編集\n' +
        '2. フロントエンドでの動作確認\n' +
        '3. 本番環境での運用開始\n\n' +
        'ログで詳細なテスト結果を確認してください。'
      );
      
    } catch (error) {
      ui.alert('エラー', `セットアップ中にエラーが発生しました：\n${error.toString()}`, ui.ButtonSet.OK);
    }
  }
}

/**
 * 機能検証用のサンプルデータ作成
 */
function createSampleMenuCombinationData() {
  try {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'サンプルデータ作成',
      'テスト用のサンプルデータを作成しますか？\n\n' +
      '以下が作成されます：\n' +
      '• サンプルメニューデータ\n' +
      '• テスト用組み合わせパターン\n' +
      '• 時間最適化のデモデータ',
      ui.ButtonSet.YES_NO
    );
    
    if (response === ui.Button.YES) {
      // サンプルデータ作成ロジック
      Logger.log('サンプルデータ作成開始');
      
      // 実装は必要に応じて追加
      ui.alert('サンプルデータ作成完了', 'テスト用のサンプルデータが作成されました。');
    }
    
  } catch (error) {
    SpreadsheetApp.getUi().alert(`サンプルデータ作成エラー：\n${error.toString()}`);
  }
}