// ========================================
// 台灣🔞成人交流深夜食堂💎-👶新生學生會- 完整 Bot (Webhook 版)
// ========================================

const { Telegraf } = require('telegraf');
const express = require('express');
const fs = require('fs');

const BOT_NAME = "食堂鎮暴秩序部隊 🤖";
const bot = new Telegraf(process.env.BOT_TOKEN);

// 使用環境變數設定
const TARGET_GROUP_ID = parseInt(process.env.TARGET_GROUP_ID); 
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(",").map(id => parseInt(id)) : [];
const GOOGLE_FORM_LINK = process.env.GOOGLE_FORM_LINK || "https://docs.google.com/forms/..."; 

const DATA_FILE = 'data.json';
let data = { joinTime: {}, readStatus: {}, formStatus: {}, points: {}, violationCount: {}, ghostStatus: {}, lastCheckin: {} };

if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
} else {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
}

function save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===== 新人加入 & 公告 =====
bot.on("new_chat_members", async (ctx) => {
    const members = ctx.message.new_chat_members;
    for (const member of members) {
        const userId = member.id;
        if (ADMIN_IDS.includes(userId)) continue;

        data.joinTime[userId] = Date.now();
        save();

        await bot.telegram.restrictChatMember(TARGET_GROUP_ID, userId, {
            can_send_messages: false,
            can_send_media_messages: false,
            can_send_other_messages: false,
            can_add_web_page_previews: false
        });

        await ctx.reply(
            `👋 歡迎 <a href="tg://user?id=${userId}">${member.first_name}</a>\n` +
            `你目前為 🔒【預設禁言】\n` +
            `請點擊置頂公告中的「我已閱讀公告 ✅」後即可開始聊天 🎺`,
            {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "我已閱讀公告 ✅", callback_data: "read_announcement" }]
                    ]
                }
            }
        );
    }
});

bot.action('read_announcement', async (ctx) => {
    const userId = ctx.from.id;
    data.readStatus[userId] = Date.now();
    save();

    await bot.telegram.restrictChatMember(TARGET_GROUP_ID, userId, {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true
    });

    await ctx.answerCbQuery("已解除禁言 ✅");
    await ctx.reply(`🎺 <a href="tg://user?id=${userId}">${ctx.from.first_name}</a> 已完成公告閱讀\n請填寫表單：${GOOGLE_FORM_LINK}`, { parse_mode: "HTML" });
});
// ===== 公告未讀提醒 =====
setInterval(() => {
    const now = Date.now();
    for (let userId in data.joinTime) {
        if (data.readStatus[userId]) continue;
        const days = Math.floor((now - data.joinTime[userId]) / (24*60*60*1000));
        if (days === 3) bot.telegram.sendMessage(TARGET_GROUP_ID, `⚠️ <a href="tg://user?id=${userId}">你</a> 已入群 3 天，請盡快點擊「我已閱讀公告」`, { parse_mode: "HTML" });
        if (days === 5) bot.telegram.sendMessage(TARGET_GROUP_ID, `⚠️ <a href="tg://user?id=${userId}">你</a> 已入群 5 天，請立即完成公告閱讀`, { parse_mode: "HTML" });
        if (days === 6) bot.telegram.sendMessage(TARGET_GROUP_ID, `❗ <a href="tg://user?id=${userId}">你</a> 已入群 6 天，明天將被移除`, { parse_mode: "HTML" });
        if (days >= 7) {
            bot.telegram.kickChatMember(TARGET_GROUP_ID, userId).catch(()=>{});
            bot.telegram.sendMessage(TARGET_GROUP_ID, `🚪 <a href="tg://user?id=${userId}">已被移除</a>（7 天未完成公告閱讀）`, { parse_mode: "HTML" });
        }
    }
}, 24*60*60*1000);

// ===== 違規監控 =====
bot.on("message", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text || "";
    const forbiddenWords = ["裸露","色情","成人","未成年","毒品","廣告","拉人","私訊"];
    const hasForbidden = forbiddenWords.some(w => text.includes(w));
    const hasLink = /(https?:\/\/|t\.me|discord|www\.|http|https)/i.test(text) || /h\s?t\s?t\s?p/i.test(text);

    if (!ADMIN_IDS.includes(userId)) {
        if (hasForbidden || hasLink) {
            await bot.telegram.deleteMessage(TARGET_GROUP_ID, ctx.message.message_id);
            data.violationCount[userId] = (data.violationCount[userId] || 0) + 1;
            save();

            const count = data.violationCount[userId];
            if (hasLink) {
                if (count === 1) {
                    await bot.telegram.restrictChatMember(TARGET_GROUP_ID, userId, { until_date: Math.floor(Date.now()/1000)+7*24*60*60 });
                    await ctx.reply(`⛔ <a href="tg://user?id=${userId}">你</a> 發送外部連結 → 禁言 7 天`, { parse_mode: "HTML" });
                } else if (count >= 2) {
                    await bot.telegram.kickChatMember(TARGET_GROUP_ID, userId);
                    await ctx.reply(`🚪 <a href="tg://user?id=${userId}">你</a> 發送外部連結 → 已被踢出`, { parse_mode: "HTML" });
                }
            } else {
                if (count === 1) ctx.reply(`⚠️ <a href="tg://user?id=${userId}">你</a> 違規 → 警告`, { parse_mode: "HTML" });
                if (count === 3) {
                    await bot.telegram.restrictChatMember(TARGET_GROUP_ID, userId, { until_date: Math.floor(Date.now()/1000)+3*24*60*60 });
                    ctx.reply(`❌ <a href="tg://user?id=${userId}">你</a> 違規 → 禁言 3 天`, { parse_mode: "HTML" });
                }
                if (count >= 5) {
                    await bot.telegram.kickChatMember(TARGET_GROUP_ID, userId);
                    ctx.reply(`🚪 <a href="tg://user?id=${userId}">你</a> 違規 → 已被踢出`, { parse_mode: "HTML" });
                }
            }
        }
    }
});

// ===== 積分系統 =====
bot.command('checkin', (ctx) => {
    const userId = ctx.from.id;
    const today = new Date().toDateString();
    if (data.lastCheckin[userId] === today) return ctx.reply("📌 你今天已簽到過了");
    data.lastCheckin[userId] = today;
    data.points[userId] = (data.points[userId] || 0) + 1;
    save();
    ctx.reply("✅ 簽到成功 +1 分");
});

bot.command('me', (ctx) => {
    const userId = ctx.from.id;
    const points = data.points[userId] || 0;
    ctx.reply(`📊 你的積分：${points}`);
});

bot.command('rank', (ctx) => {
    const ranking = Object.entries(data.points).sort((a,b)=>b[1]-a[1]).slice(0,10);
    let msg = "🏆 積分排行榜前 10 名：\n";
    ranking.forEach(([uid, pts], i) => { msg += `${i+1}. <a href="tg://user?id=${uid}">用戶</a> - ${pts} 分\n`; });
    ctx.reply(msg, { parse_mode: "HTML" });
});
// ===== 管理員指令 =====
bot.command('adminhelp', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    ctx.reply(`🔑 管理員指令：
/check <userId> → 查某人的積分
/list → 查全部成員積分
/addpoints <userId> <amount> → 手動加分
/deduct <userId> <amount> → 手動扣分
/notfilled → 查誰還沒標記「已填寫」
/rules → 推送群規
/ghostscan → 幽靈掃描（7天未互動）
/warn <userId> → 警告並記錄違規次數
/mute <userId> → 禁言
/unmute <userId> → 解除禁言
/kick <userId> → 踢出
/ban <userId> → 封鎖
/unban <userId> → 解除封鎖
/announce <文字> → 臨時公告推送`);
});

bot.command('check', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const parts = ctx.message.text.split(" ");
    const userId = parts[1];
    if (!userId) return ctx.reply("請輸入 userId");
    ctx.reply(`📊 用戶 ${userId} 積分：${data.points[userId] || 0}`);
});

bot.command('list', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    let msg = "📋 成員積分列表：\n";
    for (let uid in data.points) {
        msg += `👤 ${uid} → ${data.points[uid]} 分\n`;
    }
    ctx.reply(msg);
});

bot.command('addpoints', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const parts = ctx.message.text.split(" ");
    const userId = parts[1];
    const amount = parseInt(parts[2]);
    if (!userId || isNaN(amount)) return ctx.reply("格式錯誤：/addpoints userId 數量");
    data.points[userId] = (data.points[userId] || 0) + amount;
    save();
    ctx.reply(`✅ 已為用戶 ${userId} 增加 ${amount} 分，目前積分：${data.points[userId]}`);
});

bot.command('deduct', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const parts = ctx.message.text.split(" ");
    const userId = parts[1];
    const amount = parseInt(parts[2]);
    if (!userId || isNaN(amount)) return ctx.reply("格式錯誤：/deduct userId 數量");
    data.points[userId] = (data.points[userId] || 0) - amount;
    save();
    ctx.reply(`✅ 已為用戶 ${userId} 扣除 ${amount} 分，目前積分：${data.points[userId]}`);
});

bot.command('warn', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const parts = ctx.message.text.split(" ");
    const userId = parts[1];
    if (!userId) return ctx.reply("請輸入 userId");
    data.violationCount[userId] = (data.violationCount[userId] || 0) + 1;
    save();
    ctx.reply(`⚠️ 已警告用戶 ${userId}，目前違規次數：${data.violationCount[userId]}`);
});

bot.command('mute', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const parts = ctx.message.text.split(" ");
    const userId = parts[1];
    if (!userId) return ctx.reply("請輸入 userId");
    await bot.telegram.restrictChatMember(TARGET_GROUP_ID, userId, { can_send_messages: false });
    ctx.reply(`🔒 已禁言用戶 ${userId}`);
});

bot.command('unmute', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const parts = ctx.message.text.split(" ");
    const userId = parts[1];
    if (!userId) return ctx.reply("請輸入 userId");
    await bot.telegram.restrictChatMember(TARGET_GROUP_ID, userId, { can_send_messages: true });
    ctx.reply(`🔓 已解除禁言用戶 ${userId}`);
});

bot.command('kick', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const parts = ctx.message.text.split(" ");
    const userId = parts[1];
    if (!userId) return ctx.reply("請輸入 userId");
    await bot.telegram.kickChatMember(TARGET_GROUP_ID, userId);
    ctx.reply(`🚪 已踢出用戶 ${userId}`);
});

bot.command('announce', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const msg = ctx.message.text.replace("/announce", "").trim();
    if (!msg) return ctx.reply("請輸入公告內容");
    bot.telegram.sendMessage(TARGET_GROUP_ID, `📢 管理員公告：\n${msg}`);
});

// ===== Webhook 啟動 =====
const app = express();
app.use(express.json());

app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
    bot.handleUpdate(req.body, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`${BOT_NAME} Webhook 運行中，監控群組 ${TARGET_GROUP_ID}`);
    bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/webhook/${process.env.BOT_TOKEN}`);
});
