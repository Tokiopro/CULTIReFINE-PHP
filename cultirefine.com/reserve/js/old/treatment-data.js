// data/treatment-data.js
// 施術データ定義モジュール

export const treatmentCategories = [
    {
        id: "cat1",
        name: "自院オリジナル幹細胞培養上清液 点滴 (初回の方)",
        items: [
            {
                id: "t1",
                name: "免疫活力インフィニティ 3cc (初回)",
                duration: "約120分",
                price: "プラチナプラン内",
                minIntervalDays: 7,
            },
            {
                id: "t2",
                name: "免疫活力インフィニティ 6cc (初回)",
                duration: "約120分",
                price: "プラチナプラン内",
                minIntervalDays: 7,
            },
            {
                id: "t3",
                name: "免疫再生プレミア 1cc (初回)",
                duration: "約120分",
                price: "80,000円 (20%OFF価格)",
                minIntervalDays: 14,
            },
            {
                id: "t4",
                name: "神経プレミア 1cc (初回)",
                duration: "約120分",
                price: "80,000円 (20%OFF価格)",
                minIntervalDays: 14,
            },
        ],
    },
    {
        id: "cat2",
        name: "自院オリジナル幹細胞培養上清液 点滴 (2回目以降の方)",
        items: [
            {
                id: "t5",
                name: "免疫活力インフィニティ 3cc (2回目以降)",
                duration: "約90分",
                price: "会員価格",
                minIntervalDays: 30,
            },
            {
                id: "t6",
                name: "免疫再生プレミア 1cc (2回目以降)",
                duration: "約90分",
                price: "会員価格",
                minIntervalDays: 30,
            },
        ],
    },
    {
        id: "cat3",
        name: "NAD+注射 (初回の方)",
        items: [
            { id: "t7", name: "NAD+注射 100mg", duration: "約60分", price: "30,000円" },
            { id: "t8", name: "NAD+注射 200mg", duration: "約90分", price: "55,000円" },
        ],
    },
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