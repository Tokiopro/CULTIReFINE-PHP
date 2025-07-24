/**
 * FlexMessageテンプレート管理クラス
 * 
 * 機能:
 * - 予約確定通知テンプレート
 * - リマインダー通知テンプレート
 * - 施術後通知テンプレート
 * - チケット残枚数更新通知テンプレート
 */
class FlexMessageTemplates {
  
  /**
   * メッセージタイプに応じたFlexMessageを作成
   * @param {string} type - メッセージタイプ
   * @param {Object} content - メッセージ内容
   * @return {Object} FlexMessageオブジェクト
   */
  createMessage(type, content) {
    switch (type) {
      case 'full_booking_confirmation':
        return this.createFullBookingConfirmation(content);
      case 'partial_booking_confirmation':
        return this.createPartialBookingConfirmation(content);
      case 'ticket_balance_update':
        return this.createTicketBalanceUpdate(content);
      case 'reminder':
        return this.createReminder(content);
      case 'post_treatment':
        return this.createPostTreatment(content);
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  }

  /**
   * 予約確定通知（全情報）
   * @private
   */
  createFullBookingConfirmation(content) {
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

    return {
      type: 'flex',
      altText: `予約確定: ${date} ${time} ${menuName}`,
      contents: {
        type: 'bubble',
        size: 'giga',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '✅ ご予約が確定しました',
              weight: 'bold',
              size: 'xl',
              color: '#00C851'
            },
            {
              type: 'text',
              text: clinicName,
              size: 'sm',
              color: '#999999',
              margin: 'sm'
            }
          ],
          backgroundColor: '#F0FFF4'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // 来院者情報
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '👤 来院者',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: patientName,
                  flex: 3,
                  size: 'sm',
                  weight: 'bold'
                }
              ],
              margin: 'md'
            },
            // 日時
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '📅 日時',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: `${date} ${time}`,
                  flex: 3,
                  size: 'sm',
                  weight: 'bold',
                  color: '#FF6B6B'
                }
              ],
              margin: 'md'
            },
            // 施術内容
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '💉 施術内容',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: menuName,
                  flex: 3,
                  size: 'sm',
                  weight: 'bold',
                  wrap: true
                }
              ],
              margin: 'md'
            },
            // 所要時間
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '⏱ 所要時間',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: `${duration}分`,
                  flex: 3,
                  size: 'sm'
                }
              ],
              margin: 'md'
            },
            // 施術注意点
            ...(notes ? [{
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📝 施術注意点',
                  color: '#666666',
                  size: 'sm',
                  margin: 'md'
                },
                {
                  type: 'text',
                  text: notes,
                  size: 'sm',
                  wrap: true,
                  margin: 'sm',
                  color: '#333333'
                }
              ],
              margin: 'md',
              paddingAll: 'md',
              backgroundColor: '#FFF9E6',
              cornerRadius: 'md'
            }] : []),
            // セパレーター
            {
              type: 'separator',
              margin: 'lg'
            },
            // チケット情報
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '🎫 チケット情報',
                  weight: 'bold',
                  size: 'md',
                  color: '#1DB446'
                },
                // 消化予定枚数
                ...(ticketUsage > 0 ? [{
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '消化予定',
                      flex: 2,
                      color: '#666666',
                      size: 'sm'
                    },
                    {
                      type: 'text',
                      text: `${ticketUsage}枚`,
                      flex: 3,
                      size: 'sm',
                      color: '#FF6B6B'
                    }
                  ],
                  margin: 'sm'
                }] : []),
                // 残枚数
                {
                  type: 'box',
                  layout: 'vertical',
                  contents: [
                    {
                      type: 'text',
                      text: '残枚数（予定）',
                      color: '#666666',
                      size: 'sm',
                      margin: 'sm'
                    },
                    ...this.createTicketBalanceBoxes(ticketBalance)
                  ],
                  margin: 'sm'
                }
              ],
              margin: 'lg',
              paddingAll: 'md',
              backgroundColor: '#F5F5F5',
              cornerRadius: 'md'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '※ご予約の変更・キャンセルはお電話にてお願いします',
              size: 'xs',
              color: '#999999',
              wrap: true
            }
          ]
        }
      }
    };
  }

  /**
   * 予約確定通知（部分情報）
   * @private
   */
  createPartialBookingConfirmation(content) {
    const {
      clinicName,
      patientName,
      date,
      time,
      menuName,
      notes,
      ticketBalance
    } = content;

    return {
      type: 'flex',
      altText: `予約情報: ${date} ${patientName}様`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📋 予約情報のお知らせ',
              weight: 'bold',
              size: 'lg',
              color: '#4169E1'
            },
            {
              type: 'text',
              text: clinicName,
              size: 'sm',
              color: '#999999',
              margin: 'sm'
            }
          ],
          backgroundColor: '#F0F8FF'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // 来院者情報
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '👤 来院者',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: patientName,
                  flex: 3,
                  size: 'sm',
                  weight: 'bold'
                }
              ]
            },
            // 日付
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '📅 日付',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: date,
                  flex: 3,
                  size: 'sm',
                  weight: 'bold'
                }
              ],
              margin: 'md'
            },
            // 施術内容
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '💉 施術内容',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: menuName,
                  flex: 3,
                  size: 'sm',
                  weight: 'bold',
                  wrap: true
                }
              ],
              margin: 'md'
            },
            // 時間と注意点（含まれる場合のみ）
            ...(time ? [{
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '⏰ 時間',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: time,
                  flex: 3,
                  size: 'sm',
                  color: '#FF6B6B'
                }
              ],
              margin: 'md'
            }] : []),
            ...(notes ? [{
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📝 施術注意点',
                  color: '#666666',
                  size: 'sm',
                  margin: 'md'
                },
                {
                  type: 'text',
                  text: notes,
                  size: 'sm',
                  wrap: true,
                  margin: 'sm',
                  color: '#333333'
                }
              ],
              margin: 'md',
              paddingAll: 'md',
              backgroundColor: '#FFF9E6',
              cornerRadius: 'md'
            }] : []),
            // チケット残枚数
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '🎫 チケット残枚数',
                  weight: 'bold',
                  size: 'sm',
                  color: '#1DB446'
                },
                ...this.createTicketBalanceBoxes(ticketBalance)
              ],
              margin: 'lg',
              paddingAll: 'md',
              backgroundColor: '#F5F5F5',
              cornerRadius: 'md'
            }
          ]
        }
      }
    };
  }

  /**
   * チケット残枚数更新通知
   * @private
   */
  createTicketBalanceUpdate(content) {
    const { ticketBalance, ticketUsage } = content;

    return {
      type: 'flex',
      altText: 'チケット残枚数更新のお知らせ',
      contents: {
        type: 'bubble',
        size: 'kilo',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '🎫 チケット残枚数更新',
              weight: 'bold',
              size: 'md',
              color: '#1DB446'
            }
          ],
          backgroundColor: '#E8F5E9'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            ...(ticketUsage > 0 ? [{
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '消化枚数',
                  flex: 2,
                  color: '#666666',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: `${ticketUsage}枚`,
                  flex: 1,
                  size: 'sm',
                  color: '#FF6B6B',
                  align: 'end'
                }
              ],
              margin: 'sm'
            }] : []),
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'text',
              text: '現在の残枚数',
              size: 'sm',
              color: '#666666',
              margin: 'md'
            },
            ...this.createTicketBalanceBoxes(ticketBalance)
          ]
        }
      }
    };
  }

  /**
   * リマインダー通知
   * @private
   */
  createReminder(content) {
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

    const emoji = timing === '明日' ? '📅' : '⏰';
    const headerColor = timing === '明日' ? '#4169E1' : '#FF6B6B';
    const headerBg = timing === '明日' ? '#F0F8FF' : '#FFF0F0';

    return {
      type: 'flex',
      altText: `${timing}のご予約: ${time} ${menuName}`,
      contents: {
        type: 'bubble',
        size: 'giga',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${emoji} ${timing}のご予約リマインダー`,
              weight: 'bold',
              size: 'xl',
              color: headerColor
            },
            {
              type: 'text',
              text: clinicName,
              size: 'sm',
              color: '#999999',
              margin: 'sm'
            }
          ],
          backgroundColor: headerBg
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // 重要な情報を上部に配置
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: `${date} ${time}`,
                  size: 'xl',
                  weight: 'bold',
                  color: headerColor,
                  align: 'center'
                }
              ],
              margin: 'md',
              paddingAll: 'lg',
              backgroundColor: '#FFFBEB',
              cornerRadius: 'md'
            },
            // 詳細情報
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                // 来院者
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '👤 来院者',
                      flex: 2,
                      color: '#666666',
                      size: 'sm'
                    },
                    {
                      type: 'text',
                      text: patientName,
                      flex: 3,
                      size: 'sm',
                      weight: 'bold'
                    }
                  ]
                },
                // 施術内容
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '💉 施術内容',
                      flex: 2,
                      color: '#666666',
                      size: 'sm'
                    },
                    {
                      type: 'text',
                      text: menuName,
                      flex: 3,
                      size: 'sm',
                      weight: 'bold',
                      wrap: true
                    }
                  ],
                  margin: 'md'
                },
                // 所要時間
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '⏱ 所要時間',
                      flex: 2,
                      color: '#666666',
                      size: 'sm'
                    },
                    {
                      type: 'text',
                      text: `${duration}分`,
                      flex: 3,
                      size: 'sm'
                    }
                  ],
                  margin: 'md'
                }
              ],
              margin: 'lg'
            },
            // 施術注意点
            ...(notes ? [{
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📝 施術注意点',
                  weight: 'bold',
                  color: '#FF6B6B',
                  size: 'sm'
                },
                {
                  type: 'text',
                  text: notes,
                  size: 'sm',
                  wrap: true,
                  margin: 'sm',
                  color: '#333333'
                }
              ],
              margin: 'lg',
              paddingAll: 'md',
              backgroundColor: '#FFF9E6',
              cornerRadius: 'md'
            }] : [])
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '※お時間に遅れる場合は必ずご連絡ください',
              size: 'xs',
              color: '#999999',
              wrap: true
            }
          ]
        }
      }
    };
  }

  /**
   * 施術後通知
   * @private
   */
  createPostTreatment(content) {
    const {
      clinicName,
      patientName,
      date,
      menuName,
      ticketBalance
    } = content;

    return {
      type: 'flex',
      altText: '施術完了のお知らせ',
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '✨ 施術完了のお知らせ',
              weight: 'bold',
              size: 'lg',
              color: '#00C851'
            },
            {
              type: 'text',
              text: clinicName,
              size: 'sm',
              color: '#999999',
              margin: 'sm'
            }
          ],
          backgroundColor: '#F0FFF4'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '本日はご来院ありがとうございました',
              size: 'sm',
              color: '#666666',
              margin: 'md'
            },
            // 施術情報
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                // 来院者
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '👤 来院者',
                      flex: 2,
                      color: '#666666',
                      size: 'sm'
                    },
                    {
                      type: 'text',
                      text: patientName,
                      flex: 3,
                      size: 'sm',
                      weight: 'bold'
                    }
                  ]
                },
                // 日付
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '📅 施術日',
                      flex: 2,
                      color: '#666666',
                      size: 'sm'
                    },
                    {
                      type: 'text',
                      text: date,
                      flex: 3,
                      size: 'sm'
                    }
                  ],
                  margin: 'md'
                },
                // 施術内容
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '💉 施術内容',
                      flex: 2,
                      color: '#666666',
                      size: 'sm'
                    },
                    {
                      type: 'text',
                      text: menuName,
                      flex: 3,
                      size: 'sm',
                      weight: 'bold',
                      wrap: true
                    }
                  ],
                  margin: 'md'
                }
              ],
              margin: 'lg'
            },
            // チケット残枚数
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '🎫 チケット残枚数（更新後）',
                  weight: 'bold',
                  size: 'sm',
                  color: '#1DB446'
                },
                ...this.createTicketBalanceBoxes(ticketBalance)
              ],
              margin: 'lg',
              paddingAll: 'md',
              backgroundColor: '#F5F5F5',
              cornerRadius: 'md'
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '次回のご予約もお待ちしております',
              size: 'xs',
              color: '#999999',
              align: 'center'
            }
          ]
        }
      }
    };
  }

  /**
   * チケット残枚数表示用のボックスを作成
   * @private
   */
  createTicketBalanceBoxes(ticketBalance) {
    const boxes = [];
    
    if (ticketBalance.stemCell !== undefined) {
      boxes.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: '幹細胞培養',
            flex: 3,
            color: '#666666',
            size: 'sm'
          },
          {
            type: 'text',
            text: `${ticketBalance.stemCell}枚`,
            flex: 1,
            size: 'sm',
            align: 'end',
            weight: 'bold',
            color: ticketBalance.stemCell > 0 ? '#1DB446' : '#FF6B6B'
          }
        ],
        margin: 'sm'
      });
    }

    if (ticketBalance.treatment !== undefined) {
      boxes.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: '施術',
            flex: 3,
            color: '#666666',
            size: 'sm'
          },
          {
            type: 'text',
            text: `${ticketBalance.treatment}枚`,
            flex: 1,
            size: 'sm',
            align: 'end',
            weight: 'bold',
            color: ticketBalance.treatment > 0 ? '#1DB446' : '#FF6B6B'
          }
        ],
        margin: 'sm'
      });
    }

    if (ticketBalance.infusion !== undefined) {
      boxes.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: '点滴',
            flex: 3,
            color: '#666666',
            size: 'sm'
          },
          {
            type: 'text',
            text: `${ticketBalance.infusion}枚`,
            flex: 1,
            size: 'sm',
            align: 'end',
            weight: 'bold',
            color: ticketBalance.infusion > 0 ? '#1DB446' : '#FF6B6B'
          }
        ],
        margin: 'sm'
      });
    }

    return boxes;
  }
}