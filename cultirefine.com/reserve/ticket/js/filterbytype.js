$(document).ready(function() {
    // PHP変数をJavaScriptで利用できるようにする
    var memberType = '<?php echo $membershipInfo["member_type"] ?? ""; ?>';
    
    // ★デバッグ情報を詳細に出力★
    console.log('=== 会員タイプデバッグ ===');
    console.log('memberType値:', memberType);
    console.log('memberType長さ:', memberType.length);
    console.log('memberTypeタイプ:', typeof memberType);
    console.log('文字コード:', memberType.split('').map(c => c.charCodeAt(0)));
    
    // 空白文字や改行を可視化
    console.log('memberType(JSON):', JSON.stringify(memberType));
    
    // 各条件を個別にチェック
    var condition1 = (memberType === 'サブ会員');
    var condition2 = (memberType === 'sabukaiinn');
    console.log('condition1 (サブ会員):', condition1);
    console.log('condition2 (sabukaiinn):', condition2);
    
    // 前後の空白を除去して再チェック
    var trimmedMemberType = memberType.trim();
    console.log('trimmed memberType:', JSON.stringify(trimmedMemberType));
    
    var condition3 = (trimmedMemberType === 'サブ会員');
    var condition4 = (trimmedMemberType === 'sabukaiinn');
    console.log('condition3 (trimmed サブ会員):', condition3);
    console.log('condition4 (trimmed sabukaiinn):', condition4);
    
    // より柔軟な条件分岐
    if (memberType === 'サブ会員' || memberType === 'sabukaiinn' || 
        trimmedMemberType === 'サブ会員' || trimmedMemberType === 'sabukaiinn' ||
        memberType.includes('サブ会員') || memberType.includes('sabukaiinn')) {
        
        console.log('★条件に一致！セクションを非表示にします');
        $('.ticket_cont_reserve').css('display', 'none');
        $('.ticket_cont_used').css('display', 'none');
        
        // 実際に非表示になったかも確認
        console.log('reserve要素の表示状態:', $('.ticket_cont_reserve').css('display'));
        console.log('used要素の表示状態:', $('.ticket_cont_used').css('display'));
        
    } else {
        console.log('★条件に一致しませんでした');
    }
    
    console.log('=== デバッグ終了 ===');
});

// 代替案：より安全な実装
$(document).ready(function() {
    var memberType = '<?php echo $membershipInfo["member_type"] ?? ""; ?>';
    
    // 正規化処理
    var normalizedMemberType = memberType.trim().toLowerCase();
    
    // 複数のパターンに対応
    var subMemberPatterns = [
        'サブ会員',
        'sabukaiinn', 
        'sub_member',
        'submember',
        'サブ'
    ];
    
    var isSubMember = subMemberPatterns.some(function(pattern) {
        return memberType.includes(pattern) || normalizedMemberType.includes(pattern.toLowerCase());
    });
    
    console.log('正規化された会員タイプチェック:', isSubMember);
    
    if (isSubMember) {
        $('.ticket_cont_reserve, .ticket_cont_used').hide();
        console.log('サブ会員として処理しました');
    }
});