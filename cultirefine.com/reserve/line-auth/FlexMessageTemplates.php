<?php

/**
 * Flex Message テンプレートクラス
 * LINE Messaging API用のFlexメッセージテンプレートを生成
 */
class FlexMessageTemplates
{
    /**
     * 予約確定通知のFlexメッセージを作成
     * 
     * @param array $reservationData 予約データ
     * @return array FlexMessage
     */
    public static function createReservationConfirmation(array $reservationData): array
    {
        $clinicName = $reservationData['clinic_name'] ?? 'CLUTIREFINEクリニック';
        $patientName = $reservationData['patient_name'] ?? 'お客様';
        $date = $reservationData['date'] ?? '';
        $time = $reservationData['time'] ?? '';
        $menuName = $reservationData['menu_name'] ?? '施術';
        $duration = $reservationData['duration'] ?? 60;
        $notes = $reservationData['notes'] ?? '';
        $ticketUsage = $reservationData['ticket_usage'] ?? 0;
        $ticketBalance = $reservationData['ticket_balance'] ?? [];
        
        $bodyContents = [
            // 来院者情報
            [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '👤 来院者',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $patientName,
                        'flex' => 3,
                        'size' => 'sm',
                        'weight' => 'bold'
                    ]
                ],
                'margin' => 'md'
            ],
            // 日時
            [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '📅 日時',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $date . ' ' . $time,
                        'flex' => 3,
                        'size' => 'sm',
                        'weight' => 'bold',
                        'color' => '#FF6B6B'
                    ]
                ],
                'margin' => 'md'
            ],
            // 施術内容
            [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '💉 施術内容',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $menuName,
                        'flex' => 3,
                        'size' => 'sm',
                        'weight' => 'bold',
                        'wrap' => true
                    ]
                ],
                'margin' => 'md'
            ],
            // 所要時間
            [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '⏱ 所要時間',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $duration . '分',
                        'flex' => 3,
                        'size' => 'sm'
                    ]
                ],
                'margin' => 'md'
            ]
        ];
        
        // 施術注意点（ある場合のみ追加）
        if (!empty($notes)) {
            $bodyContents[] = [
                'type' => 'box',
                'layout' => 'vertical',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '📝 施術注意点',
                        'color' => '#666666',
                        'size' => 'sm',
                        'margin' => 'md'
                    ],
                    [
                        'type' => 'text',
                        'text' => $notes,
                        'size' => 'sm',
                        'wrap' => true,
                        'margin' => 'sm',
                        'color' => '#333333'
                    ]
                ],
                'margin' => 'md',
                'paddingAll' => 'md',
                'backgroundColor' => '#FFF9E6',
                'cornerRadius' => 'md'
            ];
        }
        
        // チケット使用情報（ある場合のみ追加）
        if ($ticketUsage > 0) {
            $bodyContents[] = ['type' => 'separator', 'margin' => 'lg'];
            $bodyContents[] = [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '🎫 チケット使用',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $ticketUsage . '枚',
                        'flex' => 3,
                        'size' => 'sm',
                        'weight' => 'bold',
                        'color' => '#FF6B6B'
                    ]
                ],
                'margin' => 'md'
            ];
            
            // チケット残数表示
            if (!empty($ticketBalance)) {
                foreach ($ticketBalance as $type => $balance) {
                    $typeName = self::getTicketTypeName($type);
                    $bodyContents[] = [
                        'type' => 'box',
                        'layout' => 'horizontal',
                        'contents' => [
                            [
                                'type' => 'text',
                                'text' => "  残り{$typeName}",
                                'flex' => 2,
                                'color' => '#999999',
                                'size' => 'xs'
                            ],
                            [
                                'type' => 'text',
                                'text' => $balance . '枚',
                                'flex' => 3,
                                'size' => 'xs',
                                'color' => '#999999'
                            ]
                        ],
                        'margin' => 'sm'
                    ];
                }
            }
        }
        
        return [
            'type' => 'flex',
            'altText' => "予約確定: {$date} {$time} {$menuName}",
            'contents' => [
                'type' => 'bubble',
                'size' => 'giga',
                'header' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => [
                        [
                            'type' => 'text',
                            'text' => '✅ ご予約が確定しました',
                            'weight' => 'bold',
                            'size' => 'xl',
                            'color' => '#00C851'
                        ],
                        [
                            'type' => 'text',
                            'text' => $clinicName,
                            'size' => 'sm',
                            'color' => '#999999',
                            'margin' => 'sm'
                        ]
                    ],
                    'backgroundColor' => '#F0FFF4'
                ],
                'body' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => $bodyContents
                ],
                'footer' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => [
                        [
                            'type' => 'text',
                            'text' => 'ご来院をお待ちしております',
                            'align' => 'center',
                            'size' => 'sm',
                            'color' => '#666666'
                        ]
                    ],
                    'margin' => 'lg',
                    'paddingTop' => 'md'
                ]
            ]
        ];
    }
    
    /**
     * チケット残数更新通知のFlexメッセージを作成
     * 
     * @param array $ticketData チケットデータ
     * @return array FlexMessage
     */
    public static function createTicketBalanceUpdate(array $ticketData): array
    {
        $patientName = $ticketData['patient_name'] ?? 'お客様';
        $companyName = $ticketData['company_name'] ?? '';
        $planName = $ticketData['plan_name'] ?? '';
        $ticketBalance = $ticketData['ticket_balance'] ?? [];
        $ticketUsage = $ticketData['ticket_usage'] ?? 1;
        $menuName = $ticketData['menu_name'] ?? '';
        
        $balanceContents = [];
        $hasLowBalance = false;
        
        // チケット種別ごとの残数表示
        foreach ($ticketBalance as $type => $data) {
            $typeName = self::getTicketTypeName($type);
            $remaining = $data['remaining'] ?? 0;
            $total = $data['total'] ?? 0;
            
            // 残数が少ない場合の警告色
            $textColor = $remaining <= 3 ? '#FF6B6B' : '#333333';
            if ($remaining <= 3) {
                $hasLowBalance = true;
            }
            
            $balanceContents[] = [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => $typeName,
                        'flex' => 3,
                        'size' => 'sm',
                        'color' => '#666666'
                    ],
                    [
                        'type' => 'text',
                        'text' => "残り {$remaining}枚",
                        'flex' => 2,
                        'size' => 'sm',
                        'weight' => 'bold',
                        'color' => $textColor,
                        'align' => 'end'
                    ]
                ],
                'margin' => 'md'
            ];
        }
        
        // 警告メッセージ
        $footerContents = [];
        if ($hasLowBalance) {
            $footerContents[] = [
                'type' => 'box',
                'layout' => 'vertical',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '⚠️ チケット残数が少なくなっています',
                        'size' => 'sm',
                        'color' => '#FF6B6B',
                        'weight' => 'bold',
                        'align' => 'center'
                    ]
                ],
                'backgroundColor' => '#FFF0F0',
                'cornerRadius' => 'md',
                'paddingAll' => 'md',
                'margin' => 'lg'
            ];
        }
        
        return [
            'type' => 'flex',
            'altText' => "チケット残数更新: {$patientName}様",
            'contents' => [
                'type' => 'bubble',
                'size' => 'giga',
                'header' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => [
                        [
                            'type' => 'text',
                            'text' => '🎫 チケット残数の更新',
                            'weight' => 'bold',
                            'size' => 'xl',
                            'color' => '#4FC3F7'
                        ],
                        [
                            'type' => 'text',
                            'text' => $patientName . '様',
                            'size' => 'md',
                            'color' => '#333333',
                            'margin' => 'sm'
                        ]
                    ],
                    'backgroundColor' => '#E3F2FD'
                ],
                'body' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => array_merge([
                        // 使用情報
                        [
                            'type' => 'box',
                            'layout' => 'horizontal',
                            'contents' => [
                                [
                                    'type' => 'text',
                                    'text' => '💉 ご利用施術',
                                    'flex' => 2,
                                    'color' => '#666666',
                                    'size' => 'sm'
                                ],
                                [
                                    'type' => 'text',
                                    'text' => $menuName,
                                    'flex' => 3,
                                    'size' => 'sm',
                                    'weight' => 'bold',
                                    'wrap' => true
                                ]
                            ]
                        ],
                        [
                            'type' => 'box',
                            'layout' => 'horizontal',
                            'contents' => [
                                [
                                    'type' => 'text',
                                    'text' => '📋 使用枚数',
                                    'flex' => 2,
                                    'color' => '#666666',
                                    'size' => 'sm'
                                ],
                                [
                                    'type' => 'text',
                                    'text' => $ticketUsage . '枚',
                                    'flex' => 3,
                                    'size' => 'sm',
                                    'weight' => 'bold',
                                    'color' => '#FF6B6B'
                                ]
                            ],
                            'margin' => 'md'
                        ],
                        ['type' => 'separator', 'margin' => 'lg'],
                        [
                            'type' => 'text',
                            'text' => '現在の残数',
                            'size' => 'md',
                            'weight' => 'bold',
                            'color' => '#333333',
                            'margin' => 'lg'
                        ]
                    ], $balanceContents)
                ],
                'footer' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => array_merge($footerContents, [
                        [
                            'type' => 'text',
                            'text' => 'いつもご利用ありがとうございます',
                            'align' => 'center',
                            'size' => 'sm',
                            'color' => '#666666'
                        ]
                    ])
                ]
            ]
        ];
    }
    
    /**
     * リマインダー通知のFlexメッセージを作成
     * 
     * @param array $reminderData リマインダーデータ
     * @param string $timing タイミング（day_before, same_day）
     * @return array FlexMessage
     */
    public static function createReminder(array $reminderData, string $timing): array
    {
        $patientName = $reminderData['patient_name'] ?? 'お客様';
        $date = $reminderData['date'] ?? '';
        $time = $reminderData['time'] ?? '';
        $menuName = $reminderData['menu_name'] ?? '施術';
        $staffName = $reminderData['staff_name'] ?? '';
        $notes = $reminderData['notes'] ?? '';
        
        $emoji = $timing === 'day_before' ? '📅' : '🕐';
        $timingText = $timing === 'day_before' ? '明日' : '本日';
        $headerColor = $timing === 'day_before' ? '#4FC3F7' : '#FF9800';
        $backgroundColor = $timing === 'day_before' ? '#E3F2FD' : '#FFF3E0';
        
        $bodyContents = [
            // 日時
            [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '📅 日時',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $date . ' ' . $time,
                        'flex' => 3,
                        'size' => 'md',
                        'weight' => 'bold',
                        'color' => '#FF6B6B'
                    ]
                ],
                'margin' => 'md'
            ],
            // 施術内容
            [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '💉 施術内容',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $menuName,
                        'flex' => 3,
                        'size' => 'sm',
                        'weight' => 'bold',
                        'wrap' => true
                    ]
                ],
                'margin' => 'md'
            ]
        ];
        
        // スタッフ名（ある場合のみ追加）
        if (!empty($staffName)) {
            $bodyContents[] = [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '👤 担当スタッフ',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $staffName,
                        'flex' => 3,
                        'size' => 'sm'
                    ]
                ],
                'margin' => 'md'
            ];
        }
        
        // 注意事項（ある場合のみ追加）
        if (!empty($notes)) {
            $bodyContents[] = [
                'type' => 'box',
                'layout' => 'vertical',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '📝 ご注意事項',
                        'color' => '#666666',
                        'size' => 'sm',
                        'margin' => 'md'
                    ],
                    [
                        'type' => 'text',
                        'text' => $notes,
                        'size' => 'sm',
                        'wrap' => true,
                        'margin' => 'sm',
                        'color' => '#333333'
                    ]
                ],
                'margin' => 'md',
                'paddingAll' => 'md',
                'backgroundColor' => '#FFF9E6',
                'cornerRadius' => 'md'
            ];
        }
        
        return [
            'type' => 'flex',
            'altText' => "{$timingText}のご予約リマインダー: {$date} {$time}",
            'contents' => [
                'type' => 'bubble',
                'size' => 'giga',
                'header' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => [
                        [
                            'type' => 'text',
                            'text' => "{$emoji} {$timingText}のご予約リマインダー",
                            'weight' => 'bold',
                            'size' => 'xl',
                            'color' => $headerColor
                        ],
                        [
                            'type' => 'text',
                            'text' => $patientName . '様',
                            'size' => 'md',
                            'color' => '#333333',
                            'margin' => 'sm'
                        ]
                    ],
                    'backgroundColor' => $backgroundColor
                ],
                'body' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => $bodyContents
                ],
                'footer' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => [
                        [
                            'type' => 'text',
                            'text' => $timing === 'day_before' ? 
                                'お気をつけてお越しください' : 
                                'ご来院をお待ちしております',
                            'align' => 'center',
                            'size' => 'sm',
                            'color' => '#666666'
                        ]
                    ],
                    'margin' => 'lg',
                    'paddingTop' => 'md'
                ]
            ]
        ];
    }
    
    /**
     * 施術後通知のFlexメッセージを作成
     * 
     * @param array $treatmentData 施術データ
     * @return array FlexMessage
     */
    public static function createPostTreatment(array $treatmentData): array
    {
        $patientName = $treatmentData['patient_name'] ?? 'お客様';
        $menuName = $treatmentData['menu_name'] ?? '施術';
        $staffName = $treatmentData['staff_name'] ?? '';
        $nextRecommendation = $treatmentData['next_recommendation'] ?? '';
        $afterCareNotes = $treatmentData['after_care_notes'] ?? '';
        
        $bodyContents = [
            // 本日の施術内容
            [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '💉 本日の施術',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $menuName,
                        'flex' => 3,
                        'size' => 'sm',
                        'weight' => 'bold',
                        'wrap' => true
                    ]
                ]
            ]
        ];
        
        // スタッフ名
        if (!empty($staffName)) {
            $bodyContents[] = [
                'type' => 'box',
                'layout' => 'horizontal',
                'contents' => [
                    [
                        'type' => 'text',
                        'text' => '👤 担当スタッフ',
                        'flex' => 2,
                        'color' => '#666666',
                        'size' => 'sm'
                    ],
                    [
                        'type' => 'text',
                        'text' => $staffName,
                        'flex' => 3,
                        'size' => 'sm'
                    ]
                ],
                'margin' => 'md'
            ];
        }
        
        // アフターケア
        if (!empty($afterCareNotes)) {
            $bodyContents[] = ['type' => 'separator', 'margin' => 'lg'];
            $bodyContents[] = [
                'type' => 'text',
                'text' => '🌟 アフターケアについて',
                'weight' => 'bold',
                'size' => 'md',
                'color' => '#4FC3F7',
                'margin' => 'lg'
            ];
            $bodyContents[] = [
                'type' => 'text',
                'text' => $afterCareNotes,
                'size' => 'sm',
                'wrap' => true,
                'color' => '#333333',
                'margin' => 'md'
            ];
        }
        
        // 次回推奨
        if (!empty($nextRecommendation)) {
            $bodyContents[] = ['type' => 'separator', 'margin' => 'lg'];
            $bodyContents[] = [
                'type' => 'text',
                'text' => '📋 次回推奨時期',
                'weight' => 'bold',
                'size' => 'md',
                'color' => '#FF9800',
                'margin' => 'lg'
            ];
            $bodyContents[] = [
                'type' => 'text',
                'text' => $nextRecommendation,
                'size' => 'sm',
                'wrap' => true,
                'color' => '#333333',
                'margin' => 'md'
            ];
        }
        
        return [
            'type' => 'flex',
            'altText' => "施術完了のお知らせ: {$patientName}様",
            'contents' => [
                'type' => 'bubble',
                'size' => 'giga',
                'header' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => [
                        [
                            'type' => 'text',
                            'text' => '✨ 本日はご来院ありがとうございました',
                            'weight' => 'bold',
                            'size' => 'xl',
                            'color' => '#00C851'
                        ],
                        [
                            'type' => 'text',
                            'text' => $patientName . '様',
                            'size' => 'md',
                            'color' => '#333333',
                            'margin' => 'sm'
                        ]
                    ],
                    'backgroundColor' => '#F0FFF4'
                ],
                'body' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => $bodyContents
                ],
                'footer' => [
                    'type' => 'box',
                    'layout' => 'vertical',
                    'contents' => [
                        [
                            'type' => 'text',
                            'text' => 'またのご来院をお待ちしております',
                            'align' => 'center',
                            'size' => 'sm',
                            'color' => '#666666'
                        ]
                    ],
                    'margin' => 'lg',
                    'paddingTop' => 'md'
                ]
            ]
        ];
    }
    
    /**
     * チケットタイプ名を取得
     * 
     * @param string $type チケットタイプ
     * @return string 表示名
     */
    private static function getTicketTypeName(string $type): string
    {
        $typeNames = [
            'stem_cell' => '幹細胞培養上清液点滴',
            'treatment' => '美容施術',
            'beauty' => '美容施術',
            'drip' => '点滴・注射',
            'injection' => '点滴・注射'
        ];
        
        return $typeNames[$type] ?? $type;
    }
}