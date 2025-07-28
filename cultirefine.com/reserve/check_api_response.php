<?php
session_start();

// 認証チェック
if (!isset($_SESSION['line_user_id'])) {
    header('Location: login.php');
    exit;
}

require_once 'line-auth/config.php';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ユーザーダッシュボード - 天満病院予約システム</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .loading-spinner {
            display: none;
            text-align: center;
            padding: 20px;
        }
        .user-card {
            margin-bottom: 20px;
        }
        .ticket-item {
            border: 1px solid #dee2e6;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 10px;
        }
        .reservation-item {
            border-left: 4px solid #007bff;
            padding: 10px;
            margin-bottom: 10px;
            background-color: #f8f9fa;
        }
        .doc-item {
            padding: 8px;
            border-bottom: 1px solid #eee;
        }
        .error-alert {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container mt-4">
        <h1 class="mb-4">ユーザーダッシュボード</h1>
        
        <!-- ローディング表示 -->
        <div id="loadingSpinner" class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">読み込み中...</span>
            </div>
            <p>ユーザー情報を取得中...</p>
        </div>
        
        <!-- エラー表示 -->
        <div id="errorAlert" class="alert alert-danger error-alert" role="alert">
            <strong>エラー:</strong> <span id="errorMessage"></span>
        </div>
        
        <!-- ユーザー情報表示エリア -->
        <div id="userContent" style="display: none;">
            
            <!-- 基本ユーザー情報 -->
            <div class="card user-card">
                <div class="card-header">
                    <h5 class="mb-0">基本情報</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-3">
                            <img id="userPicture" src="" alt="プロフィール画像" class="img-fluid rounded-circle" style="max-width: 100px;">
                        </div>
                        <div class="col-md-9">
                            <h6><strong>名前:</strong> <span id="userName"></span></h6>
                            <p><strong>LINE表示名:</strong> <span id="lineDisplayName"></span></p>
                            <p><strong>患者ID:</strong> <span id="patientId"></span></p>
                            <p><strong>年齢:</strong> <span id="patientAge"></span>歳</p>
                            <p><strong>性別:</strong> <span id="patientGender"></span></p>
                            <p><strong>カナ:</strong> <span id="patientKana"></span></p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 会員情報 -->
            <div class="card user-card">
                <div class="card-header">
                    <h5 class="mb-0">会員情報</h5>
                </div>
                <div class="card-body" id="membershipInfo">
                    <!-- 会員情報がここに動的に挿入される -->
                </div>
            </div>
            
            <!-- チケット情報 -->
            <div class="card user-card">
                <div class="card-header">
                    <h5 class="mb-0">チケット情報</h5>
                </div>
                <div class="card-body">
                    <div id="ticketList">
                        <!-- チケット情報がここに動的に挿入される -->
                    </div>
                </div>
            </div>
            
            <!-- 予約履歴 -->
            <div class="card user-card">
                <div class="card-header">
                    <h5 class="mb-0">予約履歴</h5>
                </div>
                <div class="card-body">
                    <div id="reservationHistory">
                        <!-- 予約履歴がここに動的に挿入される -->
                    </div>
                </div>
            </div>
            
            <!-- 書類一覧 -->
            <div class="card user-card">
                <div class="card-header">
                    <h5 class="mb-0">書類一覧</h5>
                </div>
                <div class="card-body">
                    <div id="documentsList">
                        <!-- 書類一覧がここに動的に挿入される -->
                    </div>
                </div>
            </div>
            
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // ページ読み込み時にユーザー情報を取得
        document.addEventListener('DOMContentLoaded', function() {
            loadUserInfo();
        });

        /**
         * ユーザー情報を取得して表示
         */
        async function loadUserInfo() {
            try {
                showLoading(true);
                hideError();
                
                const response = await fetch('api-bridge.php?action=getUserFullInfo', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error?.message || 'データの取得に失敗しました');
                }
                
                // ユーザー情報を表示
                displayUserInfo(result.data);
                
            } catch (error) {
                console.error('ユーザー情報取得エラー:', error);
                showError(error.message);
            } finally {
                showLoading(false);
            }
        }

        /**
         * ユーザー情報を画面に表示
         */
        function displayUserInfo(userData) {
            // 基本ユーザー情報
            document.getElementById('userName').textContent = userData.user.name || '未設定';
            document.getElementById('lineDisplayName').textContent = userData.user.lineDisplayName || '未設定';
            document.getElementById('patientId').textContent = userData.patientInfo.id || '未設定';
            document.getElementById('patientAge').textContent = userData.patientInfo.age || '未設定';
            document.getElementById('patientGender').textContent = getGenderText(userData.patientInfo.gender);
            document.getElementById('patientKana').textContent = userData.patientInfo.kana || '未設定';
            
            // プロフィール画像
            const userPicture = document.getElementById('userPicture');
            if (userData.user.linePictureUrl) {
                userPicture.src = userData.user.linePictureUrl;
                userPicture.style.display = 'block';
            } else {
                userPicture.style.display = 'none';
            }
            
            // 会員情報
            displayMembershipInfo(userData.membershipInfo);
            
            // チケット情報
            displayTicketInfo(userData.ticketInfo);
            
            // 予約履歴
            displayReservationHistory(userData.ReservationHistory);
            
            // 書類一覧
            displayDocuments(userData.docsinfo);
            
            // コンテンツを表示
            document.getElementById('userContent').style.display = 'block';
        }

        /**
         * 会員情報を表示
         */
        function displayMembershipInfo(membershipInfo) {
            const container = document.getElementById('membershipInfo');
            
            if (membershipInfo.isMember) {
                container.innerHTML = `
                    <p><strong>会員ステータス:</strong> <span class="badge bg-success">会員</span></p>
                    <p><strong>会員種別:</strong> ${membershipInfo.memberType}</p>
                    <p><strong>会社名:</strong> ${membershipInfo.companyName}</p>
                    <p><strong>会社ID:</strong> ${membershipInfo.companyId}</p>
                `;
            } else {
                container.innerHTML = `
                    <p><strong>会員ステータス:</strong> <span class="badge bg-secondary">非会員</span></p>
                `;
            }
        }

        /**
         * チケット情報を表示
         */
        function displayTicketInfo(ticketInfo) {
            const container = document.getElementById('ticketList');
            
            if (!ticketInfo || ticketInfo.length === 0) {
                container.innerHTML = '<p class="text-muted">チケット情報がありません</p>';
                return;
            }
            
            let html = '';
            ticketInfo.forEach(ticket => {
                html += `
                    <div class="ticket-item">
                        <h6>${ticket.treatment_name}</h6>
                        <div class="row">
                            <div class="col-sm-3">
                                <small class="text-muted">残回数</small><br>
                                <strong class="text-primary">${ticket.available_count}回</strong>
                            </div>
                            <div class="col-sm-3">
                                <small class="text-muted">使用済み</small><br>
                                <span>${ticket.used_count}回</span>
                            </div>
                            <div class="col-sm-3">
                                <small class="text-muted">総回数</small><br>
                                <span>${ticket.remaining_count}回</span>
                            </div>
                            <div class="col-sm-3">
                                <small class="text-muted">最終使用日</small><br>
                                <span>${ticket.last_used_date || '未使用'}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }

        /**
         * 予約履歴を表示
         */
        function displayReservationHistory(reservationHistory) {
            const container = document.getElementById('reservationHistory');
            
            if (!reservationHistory || reservationHistory.length === 0) {
                container.innerHTML = '<p class="text-muted">予約履歴がありません</p>';
                return;
            }
            
            let html = '';
            reservationHistory.forEach(reservation => {
                const statusBadge = getReservationStatusBadge(reservation.reservestatus);
                html += `
                    <div class="reservation-item">
                        <div class="row">
                            <div class="col-md-8">
                                <h6>${reservation.reservename}</h6>
                                <p class="mb-1">
                                    <strong>日時:</strong> ${reservation.reservedate} ${reservation.reservetime}
                                    ${reservation.end_time ? ` - ${reservation.end_time}` : ''}
                                </p>
                                <p class="mb-1"><strong>患者:</strong> ${reservation.patient_name}</p>
                                ${reservation.notes ? `<p class="mb-1"><strong>備考:</strong> ${reservation.notes}</p>` : ''}
                            </div>
                            <div class="col-md-4 text-end">
                                ${statusBadge}
                                <br><small class="text-muted">予約ID: ${reservation.history_id}</small>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }

        /**
         * 書類一覧を表示
         */
        function displayDocuments(documents) {
            const container = document.getElementById('documentsList');
            
            if (!documents || documents.length === 0) {
                container.innerHTML = '<p class="text-muted">書類がありません</p>';
                return;
            }
            
            let html = '';
            documents.forEach(doc => {
                html += `
                    <div class="doc-item">
                        <div class="row align-items-center">
                            <div class="col-md-8">
                                <h6 class="mb-1">${doc.docs_name}</h6>
                                <small class="text-muted">
                                    ${doc.treatment_name ? `施術: ${doc.treatment_name} | ` : ''}
                                    作成日: ${doc.created_at}
                                </small>
                                ${doc.notes ? `<p class="mb-0 mt-1"><small>${doc.notes}</small></p>` : ''}
                            </div>
                            <div class="col-md-4 text-end">
                                ${doc.docs_url ? `<a href="${doc.docs_url}" target="_blank" class="btn btn-sm btn-outline-primary">表示</a>` : '<span class="text-muted">URL無し</span>'}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }

        /**
         * 性別テキストを取得
         */
        function getGenderText(gender) {
            switch(gender) {
                case 'male': return '男性';
                case 'female': return '女性';
                case 'MALE': return '男性';
                case 'FEMALE': return '女性';
                default: return '未設定';
            }
        }

        /**
         * 予約ステータスのバッジを取得
         */
        function getReservationStatusBadge(status) {
            switch(status) {
                case 'confirmed':
                case '確定':
                    return '<span class="badge bg-success">確定</span>';
                case 'pending':
                case '保留':
                    return '<span class="badge bg-warning">保留</span>';
                case 'cancelled':
                case 'キャンセル':
                    return '<span class="badge bg-danger">キャンセル</span>';
                case 'completed':
                case '完了':
                    return '<span class="badge bg-info">完了</span>';
                default:
                    return `<span class="badge bg-secondary">${status}</span>`;
            }
        }

        /**
         * ローディング表示制御
         */
        function showLoading(show) {
            const spinner = document.getElementById('loadingSpinner');
            const content = document.getElementById('userContent');
            
            if (show) {
                spinner.style.display = 'block';
                content.style.display = 'none';
            } else {
                spinner.style.display = 'none';
            }
        }

        /**
         * エラー表示
         */
        function showError(message) {
            const errorAlert = document.getElementById('errorAlert');
            const errorMessage = document.getElementById('errorMessage');
            
            errorMessage.textContent = message;
            errorAlert.style.display = 'block';
        }

        /**
         * エラー非表示
         */
        function hideError() {
            const errorAlert = document.getElementById('errorAlert');
            errorAlert.style.display = 'none';
        }

        /**
         * データ再読み込み
         */
        function refreshData() {
            loadUserInfo();
        }
    </script>
</body>
</html>