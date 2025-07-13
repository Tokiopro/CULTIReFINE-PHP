// data/treatment-data.js
// 新しいメニュー構成に対応した施術データ定義

export const treatmentCategories = [
    // =====================================
    // チケット利用可能メニュー
    // =====================================
    {
        id: "ticket_menu",
        name: "チケット利用可能メニュー",
        items: [
            // 点滴・注射カテゴリ
            {
                id: "ticket_drip_injection",
                name: "点滴・注射",
                isSubCategory: true,
                subItems: [
                    {
                        id: "ticket_stem_cell",
                        name: "幹細胞培養上清液",
                        isSubSubCategory: true,
                        treatments: [
                            {
                                id: "tkt_sc_1cc",
                                name: "1cc",
                                duration: "約90分",
                                price: "80,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "tkt_sc_2cc", 
                                name: "2cc",
                                duration: "約90分",
                                price: "150,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "tkt_sc_3cc",
                                name: "3cc", 
                                duration: "約120分",
                                price: "220,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "tkt_sc_4cc",
                                name: "4cc",
                                duration: "約120分", 
                                price: "280,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "tkt_sc_5cc",
                                name: "5cc",
                                duration: "約120分",
                                price: "340,000円", 
                                minIntervalDays: 14,
                            }
                        ]
                    }
                ]
            },
            // 美容施術カテゴリ  
            {
                id: "ticket_beauty",
                name: "美容施術",
                isSubCategory: true,
                subItems: [
                    {
                        id: "tkt_beauty_a",
                        name: "美容施術A（サンプル）",
                        duration: "約60分",
                        price: "チケット利用",
                        ticketInfo: "プラチナプラン対象（残り2枚）",
                        minIntervalDays: 7,
                    },
                    {
                        id: "tkt_beauty_b", 
                        name: "美容施術B（サンプル）",
                        duration: "約75分",
                        price: "チケット利用", 
                        ticketInfo: "プラチナプラン対象（残り2枚）",
                        minIntervalDays: 7,
                    }
                ]
            }
        ]
    },
    
    // =====================================
    // 通常メニュー（チケット利用不可）
    // =====================================
    {
        id: "regular_menu",
        name: "通常メニュー（チケット利用不可）",
        items: [
            // 点滴・注射カテゴリ
            {
                id: "regular_drip_injection",
                name: "点滴・注射", 
                isSubCategory: true,
                subItems: [
                    {
                        id: "regular_stem_cell",
                        name: "幹細胞培養上清液",
                        isSubSubCategory: true,
                        treatments: [
                            {
                                id: "reg_sc_1cc",
                                name: "1cc",
                                duration: "約90分",
                                price: "80,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "reg_sc_2cc",
                                name: "2cc", 
                                duration: "約90分",
                                price: "150,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "reg_sc_3cc",
                                name: "3cc",
                                duration: "約120分", 
                                price: "220,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "reg_sc_4cc",
                                name: "4cc",
                                duration: "約120分",
                                price: "280,000円",
                                minIntervalDays: 14,
                            },
                            {
                                id: "reg_sc_5cc", 
                                name: "5cc",
                                duration: "約120分",
                                price: "340,000円",
                                minIntervalDays: 14,
                            }
                        ]
                    }
                ]
            },
            // 美容施術カテゴリ
            {
                id: "regular_beauty",
                name: "美容施術",
                isSubCategory: true, 
                subItems: [
                    {
                        id: "reg_beauty_sample",
                        name: "美容施術C（サンプル）",
                        duration: "約90分",
                        price: "50,000円",
                        minIntervalDays: 14,
                    }
                ]
            }
        ]
    }
];

export function formatDateKey(date) {
    return date.toISOString().split("T")[0];
}

export function generateTimeSlotsData() {
    var data = {};
    var today = new Date();
    
    // Generate mock data for next 30 days
    for (var i = 1; i <= 30; i++) {
        var date = new Date(today);
        date.setDate(today.getDate() + i);
        var dateKey = formatDateKey(date);
        
        data[dateKey] = [
            { time: "10:00", status: "available" },
            { time: "10:30", status: "available" },
            { time: "11:00", status: Math.random() > 0.7 ? "pair_only" : "available" },
            { time: "11:30", status: Math.random() > 0.8 ? "unavailable" : "available" },
            { time: "14:00", status: "available" },
            { time: "14:30", status: Math.random() > 0.9 ? "single_only" : "available" },
            { time: "15:00", status: "available" },
            { time: "15:30", status: "available" },
        ];
    }
    
    return data;
}

export const timeSlotsData = generateTimeSlotsData();