/**
 * 会社別会員向け通知テンプレート
 * LINE Flex Messageテンプレートを管理
 */
class CompanyMemberNotificationTemplates {
  
  /**
   * 予約確定通知（全項目）のFlexMessageテンプレート
   */
  static createFullReservationConfirmation(reservation, companyName) {
    const reservationDate = new Date(reservation.date);
    const formattedDate = Utilities.formatDate(reservationDate, 'Asia/Tokyo', 'yyyy年MM月dd日(E)');
    const formattedTime = reservation.start_time || '未定';
    
    return {
      type: 'flex',
      altText: `予約確定：${formattedDate} ${formattedTime}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '予約確定のお知らせ',
              weight: 'bold',
              size: 'lg',
              color: '#1DB446'
            }
          ],
          backgroundColor: '#F0F0F0',
          paddingAll: '10px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // 会社名
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '会社名',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: companyName || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
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
                  text: '日時',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${formattedDate} ${formattedTime}`,
                  size: 'sm',
                  flex: 3,
                  wrap: true
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
                  text: '施術内容',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: reservation.menu_name || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
                }
              ],
              margin: 'md'
            },
            // 施術時間
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '施術時間',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${reservation.duration || 60}分`,
                  size: 'sm',
                  flex: 3
                }
              ],
              margin: 'md'
            },
            // 施術注意点
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '施術注意点',
                  size: 'sm',
                  color: '#555555',
                  margin: 'md'
                },
                {
                  type: 'text',
                  text: reservation.notes || 'なし',
                  size: 'sm',
                  wrap: true,
                  margin: 'sm'
                }
              ]
            },
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
                  text: 'チケット情報',
                  size: 'sm',
                  weight: 'bold',
                  color: '#1DB446',
                  margin: 'md'
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '消化予定枚数',
                      size: 'sm',
                      color: '#555555',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: `${reservation.ticket_count || 0}枚`,
                      size: 'sm',
                      flex: 1
                    }
                  ],
                  margin: 'sm'
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: '残枚数',
                      size: 'sm',
                      color: '#555555',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: `${reservation.remaining_tickets || 0}枚`,
                      size: 'sm',
                      flex: 1,
                      weight: 'bold',
                      color: '#FF5551'
                    }
                  ],
                  margin: 'sm'
                }
              ]
            }
          ],
          paddingAll: '15px'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ご不明な点がございましたらお問い合わせください。',
              size: 'xs',
              color: '#888888',
              wrap: true
            }
          ],
          paddingAll: '10px'
        }
      }
    };
  }

  /**
   * 部分的な予約確定通知（指定項目を除外）
   */
  static createPartialReservationConfirmation(reservation, companyName, excludeItems = []) {
    const reservationDate = new Date(reservation.date);
    const formattedDate = Utilities.formatDate(reservationDate, 'Asia/Tokyo', 'yyyy年MM月dd日(E)');
    const formattedTime = reservation.start_time || '未定';
    
    const bodyContents = [];
    
    // 会社名
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '会社名',
          size: 'sm',
          color: '#555555',
          flex: 2
        },
        {
          type: 'text',
          text: companyName || '未設定',
          size: 'sm',
          flex: 3,
          wrap: true
        }
      ],
      margin: 'md'
    });

    // 日時
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '日時',
          size: 'sm',
          color: '#555555',
          flex: 2
        },
        {
          type: 'text',
          text: `${formattedDate} ${formattedTime}`,
          size: 'sm',
          flex: 3,
          wrap: true
        }
      ],
      margin: 'md'
    });

    // 施術内容
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: '施術内容',
          size: 'sm',
          color: '#555555',
          flex: 2
        },
        {
          type: 'text',
          text: reservation.menu_name || '未設定',
          size: 'sm',
          flex: 3,
          wrap: true
        }
      ],
      margin: 'md'
    });

    // 時間（除外対象でない場合のみ）
    if (!excludeItems.includes('時間')) {
      bodyContents.push({
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: '施術時間',
            size: 'sm',
            color: '#555555',
            flex: 2
          },
          {
            type: 'text',
            text: `${reservation.duration || 60}分`,
            size: 'sm',
            flex: 3
          }
        ],
        margin: 'md'
      });
    }

    // 施術注意点（除外対象でない場合のみ）
    if (!excludeItems.includes('施術注意点')) {
      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '施術注意点',
            size: 'sm',
            color: '#555555',
            margin: 'md'
          },
          {
            type: 'text',
            text: reservation.notes || 'なし',
            size: 'sm',
            wrap: true,
            margin: 'sm'
          }
        ]
      });
    }

    // チケット残枚数更新
    bodyContents.push({
      type: 'separator',
      margin: 'lg'
    });
    
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: 'チケット残枚数',
          size: 'sm',
          color: '#555555',
          flex: 2
        },
        {
          type: 'text',
          text: `${reservation.remaining_tickets || 0}枚`,
          size: 'sm',
          flex: 1,
          weight: 'bold',
          color: '#FF5551'
        }
      ],
      margin: 'md'
    });

    return {
      type: 'flex',
      altText: `予約確定：${formattedDate} ${formattedTime}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '予約確定のお知らせ',
              weight: 'bold',
              size: 'lg',
              color: '#1DB446'
            }
          ],
          backgroundColor: '#F0F0F0',
          paddingAll: '10px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: bodyContents,
          paddingAll: '15px'
        }
      }
    };
  }

  /**
   * チケット残枚数のみの通知
   */
  static createTicketBalanceNotification(companyName, remainingTickets) {
    return {
      type: 'flex',
      altText: 'チケット残枚数更新のお知らせ',
      contents: {
        type: 'bubble',
        size: 'micro',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'チケット残枚数更新',
              weight: 'bold',
              size: 'sm',
              color: '#1DB446'
            }
          ],
          backgroundColor: '#F0F0F0',
          paddingAll: '10px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: companyName,
              size: 'xs',
              color: '#555555'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '残枚数',
                  size: 'md',
                  color: '#555555'
                },
                {
                  type: 'text',
                  text: `${remainingTickets}枚`,
                  size: 'lg',
                  weight: 'bold',
                  color: '#FF5551',
                  align: 'end'
                }
              ],
              margin: 'md'
            }
          ],
          paddingAll: '15px'
        }
      }
    };
  }

  /**
   * リマインダー通知のテンプレート
   */
  static createReminderNotification(reservation, type) {
    const reservationDate = new Date(reservation.date);
    const formattedDate = Utilities.formatDate(reservationDate, 'Asia/Tokyo', 'yyyy年MM月dd日(E)');
    const formattedTime = reservation.start_time || '未定';
    const title = type === 'dayBefore' ? '明日のご予約' : '本日のご予約';
    
    return {
      type: 'flex',
      altText: `${title}のお知らせ`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${title}のお知らせ`,
              weight: 'bold',
              size: 'lg',
              color: '#4169E1'
            }
          ],
          backgroundColor: '#F0F0F0',
          paddingAll: '10px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // 来院者名
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '来院者名',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: reservation.visitor_name || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
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
                  text: '日時',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${formattedDate} ${formattedTime}`,
                  size: 'sm',
                  flex: 3,
                  wrap: true,
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
                  text: '施術内容',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: reservation.menu_name || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
                }
              ],
              margin: 'md'
            },
            // 施術時間
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '施術時間',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${reservation.duration || 60}分`,
                  size: 'sm',
                  flex: 3
                }
              ],
              margin: 'md'
            },
            // 施術注意点
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'text',
              text: '施術注意点',
              size: 'sm',
              color: '#555555',
              margin: 'md'
            },
            {
              type: 'text',
              text: reservation.notes || '特にありません',
              size: 'sm',
              wrap: true,
              margin: 'sm'
            }
          ],
          paddingAll: '15px'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'お気をつけてお越しください。',
              size: 'xs',
              color: '#888888',
              wrap: true
            }
          ],
          paddingAll: '10px'
        }
      }
    };
  }

  /**
   * 施術後通知（全項目）のテンプレート
   */
  static createPostTreatmentFullNotification(reservation, companyName) {
    const reservationDate = new Date(reservation.date);
    const formattedDate = Utilities.formatDate(reservationDate, 'Asia/Tokyo', 'yyyy年MM月dd日(E)');
    
    return {
      type: 'flex',
      altText: 'ご来院ありがとうございました',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ご来院ありがとうございました',
              weight: 'bold',
              size: 'lg',
              color: '#FF6B6B'
            }
          ],
          backgroundColor: '#FFF0F0',
          paddingAll: '10px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // 来院者名
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '来院者名',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: reservation.visitor_name || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
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
                  text: '来院日時',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: formattedDate,
                  size: 'sm',
                  flex: 3,
                  wrap: true
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
                  text: '施術内容',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: reservation.menu_name || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
                }
              ],
              margin: 'md'
            },
            // 施術注意点
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'text',
              text: '施術後の注意事項',
              size: 'sm',
              color: '#555555',
              weight: 'bold',
              margin: 'md'
            },
            {
              type: 'text',
              text: reservation.aftercare_notes || '特にありません',
              size: 'sm',
              wrap: true,
              margin: 'sm'
            },
            // チケット残枚数
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'チケット残枚数',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${reservation.remaining_tickets || 0}枚`,
                  size: 'md',
                  flex: 1,
                  weight: 'bold',
                  color: '#FF5551'
                }
              ],
              margin: 'md'
            }
          ],
          paddingAll: '15px'
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '次回のご来院もお待ちしております。',
              size: 'xs',
              color: '#888888',
              wrap: true
            }
          ],
          paddingAll: '10px'
        }
      }
    };
  }

  /**
   * 施術後通知（部分）のテンプレート
   */
  static createPostTreatmentPartialNotification(reservation, companyName) {
    const reservationDate = new Date(reservation.date);
    const formattedDate = Utilities.formatDate(reservationDate, 'Asia/Tokyo', 'yyyy年MM月dd日(E)');
    
    return {
      type: 'flex',
      altText: 'ご来院ありがとうございました',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ご来院ありがとうございました',
              weight: 'bold',
              size: 'lg',
              color: '#FF6B6B'
            }
          ],
          backgroundColor: '#FFF0F0',
          paddingAll: '10px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            // 来院者名
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: '来院者名',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: reservation.visitor_name || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
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
                  text: '来院日時',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: formattedDate,
                  size: 'sm',
                  flex: 3,
                  wrap: true
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
                  text: '施術内容',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: reservation.menu_name || '未設定',
                  size: 'sm',
                  flex: 3,
                  wrap: true
                }
              ],
              margin: 'md'
            },
            // チケット残枚数
            {
              type: 'separator',
              margin: 'lg'
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'text',
                  text: 'チケット残枚数',
                  size: 'sm',
                  color: '#555555',
                  flex: 2
                },
                {
                  type: 'text',
                  text: `${reservation.remaining_tickets || 0}枚`,
                  size: 'md',
                  flex: 1,
                  weight: 'bold',
                  color: '#FF5551'
                }
              ],
              margin: 'md'
            }
          ],
          paddingAll: '15px'
        }
      }
    };
  }
}