# CLUTIREFINEクリニック予約システム - ファイル構成

## ディレクトリ構造
js/
├── core/
│   ├── polyfills.js          # ブラウザ互換性
│   ├── storage-manager.js    # LocalStorage管理
│   ├── app-state.js         # アプリケーション状態管理
│   └── ui-helpers.js        # UI共通関数
├── data/
│   ├── treatment-data.js    # 施術データ定義
│   └── mock-api.js          # Mock API関数群
├── components/
│   ├── calendar.js          # カレンダーコンポーネント
│   ├── treatment-accordion.js # 施術メニューアコーディオン
│   └── modal.js             # モーダル管理
├── screens/
│   ├── patient-selection.js # 患者選択画面
│   ├── menu-calendar.js     # メニュー・カレンダー画面
│   ├── pair-booking.js      # ペア予約画面
│   └── bulk-booking.js      # 一括予約画面
└── main.js                  # メイン初期化・統合