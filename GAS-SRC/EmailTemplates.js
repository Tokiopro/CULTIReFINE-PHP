/**
 * メールテンプレート管理クラス
 * 
 * 機能:
 * - HTMLメールテンプレートの生成
 * - 通知タイプ別のメール本文作成
 */
class EmailTemplates {
  
  /**
   * メール本文を作成
   * @param {string} type - メッセージタイプ
   * @param {Object} content - メッセージ内容
   * @return {Object} メール本文（HTML/プレーンテキスト）
   */
  createEmailBody(type, content) {
    switch (type) {
      case 'full_booking_confirmation':
        return this.createFullBookingConfirmationEmail(content);
      case 'partial_booking_confirmation':
        return this.createPartialBookingConfirmationEmail(content);
      case 'ticket_balance_update':
        return this.createTicketBalanceUpdateEmail(content);
      case 'reminder':
        return this.createReminderEmail(content);
      case 'post_treatment':
        return this.createPostTreatmentEmail(content);
      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  }

  /**
   * 基本的なHTMLテンプレート
   * @private
   */
  getBaseTemplate(title, content) {
    return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      color: #333333;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }
    .clinic-name {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 5px;
    }
    .content {
      padding: 30px 20px;
    }
    .section {
      margin-bottom: 25px;
      padding: 20px;
      background-color: #f9f9f9;
      border-radius: 8px;
      border-left: 4px solid #4CAF50;
    }
    .info-row {
      display: flex;
      margin-bottom: 12px;
      align-items: flex-start;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      min-width: 100px;
      margin-right: 15px;
    }
    .info-value {
      flex: 1;
      color: #333;
    }
    .highlight {
      color: #FF5722;
      font-weight: bold;
    }
    .ticket-section {
      background-color: #E8F5E9;
      border-left-color: #4CAF50;
    }
    .ticket-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #C8E6C9;
    }
    .ticket-row:last-child {
      border-bottom: none;
    }
    .footer {
      background-color: #f5f5f5;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .button {
      display: inline-block;
      padding: 12px 30px;
      background-color: #4CAF50;
      color: white;
      text-decoration: none;
      border-radius: 25px;
      margin: 20px 0;
    }
    .notes-box {
      background-color: #FFF9C4;
      border-left-color: #FFC107;
      padding: 15px;
      margin: 20px 0;
    }
    .notes-box .title {
      font-weight: bold;
      color: #F57C00;
      margin-bottom: 8px;
    }
    @media only screen and (max-width: 600px) {
      .info-row {
        flex-direction: column;
      }
      .info-label {
        margin-bottom: 5px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    ${content}
  </div>
</body>
</html>
    `;
  }

  /**
   * 予約確定通知（全情報）メール
   * @private
   */
  createFullBookingConfirmationEmail(content) {
    const {
      clinicName,
      patientName,
      date,
      time,
      menuName,
      duration,
      notes,
      ticketUsage,
      ticketBalance
    } = content;

    const htmlContent = `
      <div class="header">
        <h1>✅ ご予約が確定しました</h1>
        <div class="clinic-name">${clinicName}</div>
      </div>
      <div class="content">
        <p>${patientName}様</p>
        <p>この度はご予約いただき、誠にありがとうございます。<br>以下の内容でご予約を承りました。</p>
        
        <div class="section">
          <div class="info-row">
            <div class="info-label">👤 来院者</div>
            <div class="info-value">${patientName}様</div>
          </div>
          <div class="info-row">
            <div class="info-label">📅 日時</div>
            <div class="info-value highlight">${date} ${time}</div>
          </div>
          <div class="info-row">
            <div class="info-label">💉 施術内容</div>
            <div class="info-value">${menuName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">⏱ 所要時間</div>
            <div class="info-value">${duration}分</div>
          </div>
        </div>

        ${notes ? `
        <div class="notes-box">
          <div class="title">📝 施術注意点</div>
          <div>${notes}</div>
        </div>
        ` : ''}

        <div class="section ticket-section">
          <h3 style="margin-top: 0; color: #388E3C;">🎫 チケット情報</h3>
          ${ticketUsage > 0 ? `
          <div class="ticket-row">
            <span>消化予定枚数</span>
            <span class="highlight">${ticketUsage}枚</span>
          </div>
          ` : ''}
          <div style="margin-top: 15px;">
            <div style="font-weight: bold; margin-bottom: 10px;">残枚数（予定）</div>
            ${this.createTicketBalanceRows(ticketBalance)}
          </div>
        </div>

        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          ※ご予約の変更・キャンセルはお電話にてお願いいたします。
        </p>
      </div>
      <div class="footer">
        <p>${clinicName}</p>
        <p>このメールは自動送信されています。</p>
      </div>
    `;

    const plainText = `
${patientName}様

ご予約が確定しました。

【予約内容】
来院者: ${patientName}様
日時: ${date} ${time}
施術内容: ${menuName}
所要時間: ${duration}分
${notes ? `\n施術注意点:\n${notes}\n` : ''}

【チケット情報】
${ticketUsage > 0 ? `消化予定枚数: ${ticketUsage}枚\n` : ''}
残枚数（予定）:
${this.createTicketBalancePlainText(ticketBalance)}

※ご予約の変更・キャンセルはお電話にてお願いいたします。

${clinicName}
    `;

    return {
      html: this.getBaseTemplate('ご予約確定のお知らせ', htmlContent),
      text: plainText.trim()
    };
  }

  /**
   * 予約確定通知（部分情報）メール
   * @private
   */
  createPartialBookingConfirmationEmail(content) {
    const {
      clinicName,
      patientName,
      date,
      time,
      menuName,
      notes,
      ticketBalance
    } = content;

    const htmlContent = `
      <div class="header" style="background-color: #2196F3;">
        <h1>📋 予約情報のお知らせ</h1>
        <div class="clinic-name">${clinicName}</div>
      </div>
      <div class="content">
        <p>予約情報をお知らせいたします。</p>
        
        <div class="section">
          <div class="info-row">
            <div class="info-label">👤 来院者</div>
            <div class="info-value">${patientName}様</div>
          </div>
          <div class="info-row">
            <div class="info-label">📅 日付</div>
            <div class="info-value">${date}</div>
          </div>
          ${time ? `
          <div class="info-row">
            <div class="info-label">⏰ 時間</div>
            <div class="info-value highlight">${time}</div>
          </div>
          ` : ''}
          <div class="info-row">
            <div class="info-label">💉 施術内容</div>
            <div class="info-value">${menuName}</div>
          </div>
        </div>

        ${notes ? `
        <div class="notes-box">
          <div class="title">📝 施術注意点</div>
          <div>${notes}</div>
        </div>
        ` : ''}

        <div class="section ticket-section">
          <h3 style="margin-top: 0; color: #388E3C;">🎫 チケット残枚数</h3>
          ${this.createTicketBalanceRows(ticketBalance)}
        </div>
      </div>
      <div class="footer">
        <p>${clinicName}</p>
        <p>このメールは自動送信されています。</p>
      </div>
    `;

    const plainText = `
予約情報のお知らせ

【予約内容】
来院者: ${patientName}様
日付: ${date}
${time ? `時間: ${time}\n` : ''}
施術内容: ${menuName}
${notes ? `\n施術注意点:\n${notes}\n` : ''}

【チケット残枚数】
${this.createTicketBalancePlainText(ticketBalance)}

${clinicName}
    `;

    return {
      html: this.getBaseTemplate('予約情報のお知らせ', htmlContent),
      text: plainText.trim()
    };
  }

  /**
   * チケット残枚数更新通知メール
   * @private
   */
  createTicketBalanceUpdateEmail(content) {
    const { ticketBalance, ticketUsage } = content;

    const htmlContent = `
      <div class="header" style="background-color: #4CAF50;">
        <h1>🎫 チケット残枚数更新のお知らせ</h1>
      </div>
      <div class="content">
        <p>チケット残枚数が更新されました。</p>
        
        ${ticketUsage > 0 ? `
        <div class="section">
          <div class="info-row">
            <div class="info-label">消化枚数</div>
            <div class="info-value highlight">${ticketUsage}枚</div>
          </div>
        </div>
        ` : ''}

        <div class="section ticket-section">
          <h3 style="margin-top: 0; color: #388E3C;">現在の残枚数</h3>
          ${this.createTicketBalanceRows(ticketBalance)}
        </div>
      </div>
      <div class="footer">
        <p>CULTIReFINE</p>
        <p>このメールは自動送信されています。</p>
      </div>
    `;

    const plainText = `
チケット残枚数更新のお知らせ

${ticketUsage > 0 ? `消化枚数: ${ticketUsage}枚\n\n` : ''}
【現在の残枚数】
${this.createTicketBalancePlainText(ticketBalance)}

CULTIReFINE
    `;

    return {
      html: this.getBaseTemplate('チケット残枚数更新', htmlContent),
      text: plainText.trim()
    };
  }

  /**
   * リマインダー通知メール
   * @private
   */
  createReminderEmail(content) {
    const {
      clinicName,
      patientName,
      date,
      time,
      menuName,
      duration,
      notes,
      timing
    } = content;

    const headerColor = timing === '明日' ? '#2196F3' : '#FF5722';
    const emoji = timing === '明日' ? '📅' : '⏰';

    const htmlContent = `
      <div class="header" style="background-color: ${headerColor};">
        <h1>${emoji} ${timing}のご予約リマインダー</h1>
        <div class="clinic-name">${clinicName}</div>
      </div>
      <div class="content">
        <p>${patientName}様</p>
        <p>${timing}のご予約についてお知らせいたします。</p>
        
        <div class="section" style="border-left-color: ${headerColor};">
          <div style="text-align: center; font-size: 20px; font-weight: bold; color: ${headerColor}; margin-bottom: 20px;">
            ${date} ${time}
          </div>
          <div class="info-row">
            <div class="info-label">👤 来院者</div>
            <div class="info-value">${patientName}様</div>
          </div>
          <div class="info-row">
            <div class="info-label">💉 施術内容</div>
            <div class="info-value">${menuName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">⏱ 所要時間</div>
            <div class="info-value">${duration}分</div>
          </div>
        </div>

        ${notes ? `
        <div class="notes-box">
          <div class="title">📝 施術注意点</div>
          <div>${notes}</div>
        </div>
        ` : ''}

        <p style="margin-top: 30px; font-size: 14px; color: #666;">
          ※お時間に遅れる場合は必ずご連絡ください。
        </p>
      </div>
      <div class="footer">
        <p>${clinicName}</p>
        <p>このメールは自動送信されています。</p>
      </div>
    `;

    const plainText = `
${patientName}様

${timing}のご予約リマインダー

【予約内容】
日時: ${date} ${time}
来院者: ${patientName}様
施術内容: ${menuName}
所要時間: ${duration}分
${notes ? `\n施術注意点:\n${notes}\n` : ''}

※お時間に遅れる場合は必ずご連絡ください。

${clinicName}
    `;

    return {
      html: this.getBaseTemplate(`${timing}のご予約リマインダー`, htmlContent),
      text: plainText.trim()
    };
  }

  /**
   * 施術後通知メール
   * @private
   */
  createPostTreatmentEmail(content) {
    const {
      clinicName,
      patientName,
      date,
      menuName,
      ticketBalance
    } = content;

    const htmlContent = `
      <div class="header" style="background-color: #4CAF50;">
        <h1>✨ 施術完了のお知らせ</h1>
        <div class="clinic-name">${clinicName}</div>
      </div>
      <div class="content">
        <p>${patientName}様</p>
        <p>本日はご来院いただき、誠にありがとうございました。</p>
        
        <div class="section">
          <div class="info-row">
            <div class="info-label">👤 来院者</div>
            <div class="info-value">${patientName}様</div>
          </div>
          <div class="info-row">
            <div class="info-label">📅 施術日</div>
            <div class="info-value">${date}</div>
          </div>
          <div class="info-row">
            <div class="info-label">💉 施術内容</div>
            <div class="info-value">${menuName}</div>
          </div>
        </div>

        <div class="section ticket-section">
          <h3 style="margin-top: 0; color: #388E3C;">🎫 チケット残枚数（更新後）</h3>
          ${this.createTicketBalanceRows(ticketBalance)}
        </div>

        <p style="margin-top: 30px; text-align: center;">
          <a href="#" class="button" style="background-color: #4CAF50; color: white; text-decoration: none;">次回のご予約はこちら</a>
        </p>

        <p style="text-align: center; color: #666; font-size: 14px;">
          次回のご予約もお待ちしております。
        </p>
      </div>
      <div class="footer">
        <p>${clinicName}</p>
        <p>このメールは自動送信されています。</p>
      </div>
    `;

    const plainText = `
${patientName}様

本日はご来院いただき、誠にありがとうございました。

【施術内容】
来院者: ${patientName}様
施術日: ${date}
施術内容: ${menuName}

【チケット残枚数（更新後）】
${this.createTicketBalancePlainText(ticketBalance)}

次回のご予約もお待ちしております。

${clinicName}
    `;

    return {
      html: this.getBaseTemplate('施術完了のお知らせ', htmlContent),
      text: plainText.trim()
    };
  }

  /**
   * チケット残枚数のHTML行を作成
   * @private
   */
  createTicketBalanceRows(ticketBalance) {
    let html = '';
    
    if (ticketBalance.stemCell !== undefined) {
      const color = ticketBalance.stemCell > 0 ? '#4CAF50' : '#F44336';
      html += `
        <div class="ticket-row">
          <span>幹細胞培養</span>
          <span style="color: ${color}; font-weight: bold;">${ticketBalance.stemCell}枚</span>
        </div>
      `;
    }

    if (ticketBalance.treatment !== undefined) {
      const color = ticketBalance.treatment > 0 ? '#4CAF50' : '#F44336';
      html += `
        <div class="ticket-row">
          <span>施術</span>
          <span style="color: ${color}; font-weight: bold;">${ticketBalance.treatment}枚</span>
        </div>
      `;
    }

    if (ticketBalance.infusion !== undefined) {
      const color = ticketBalance.infusion > 0 ? '#4CAF50' : '#F44336';
      html += `
        <div class="ticket-row">
          <span>点滴</span>
          <span style="color: ${color}; font-weight: bold;">${ticketBalance.infusion}枚</span>
        </div>
      `;
    }

    return html;
  }

  /**
   * チケット残枚数のプレーンテキストを作成
   * @private
   */
  createTicketBalancePlainText(ticketBalance) {
    let text = '';
    
    if (ticketBalance.stemCell !== undefined) {
      text += `幹細胞培養: ${ticketBalance.stemCell}枚\n`;
    }
    if (ticketBalance.treatment !== undefined) {
      text += `施術: ${ticketBalance.treatment}枚\n`;
    }
    if (ticketBalance.infusion !== undefined) {
      text += `点滴: ${ticketBalance.infusion}枚\n`;
    }
    
    return text.trim();
  }
}