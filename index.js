// ========================================
// 台灣🔞成人交流深夜食堂💎-👶新生學生會- 完整 Bot
// ========================================

const { Telegraf, Markup } = require('telegraf');
const BOT_NAME = "食堂鎮暴秩序部隊 🤖";
const bot = new Telegraf(process.env.BOT_TOKEN); // 改成讀環境變數
const TARGET_GROUP_ID = -1003742241522;
const ADMIN_IDS = [8165338666, 8392427662];
const GOOGLE_FORM_LINK = "https://docs.google.com/forms/d/e/1FAIpQLSfjXx5H0b402yqpAjnSluQHse59qL2GO5zup0pINR5Mau3C0w/viewform?usp=sharing";

// ===== JSON 儲存資料 =====
const fs = require('fs');
const DATA_FILE = 'data.json';
let data = { joinTime: {}, readStatus: {}, formStatus: {}, points: {}, violationCount: {}, ghostStatus: {} };

// 如果檔案不存在，先建立一個空的
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
} else {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
}

// 儲存資料
function save() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===== 公告已讀按鈕 =====
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

    await ctx.reply(
        `🎺 <a href="tg://user?id=${userId}">${ctx.from.first_name}</a> 已完成公告閱讀\n請填寫表單：${GOOGLE_FORM_LINK}`,
        { parse_mode: "HTML" }
    );
});

// ===== 新人加入自動禁言 =====
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
            `請點擊置頂公告中的「我已閱讀公告」後即可開始聊天 🎺`,
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

// ===== 公告未讀提醒（3/5/6/7 天踢出） =====
setInterval(() => {
    const now = Date.now();
    for (let userId in data.joinTime) {
        if (data.readStatus[userId]) continue;

        const days = Math.floor((now - data.joinTime[userId]) / (24*60*60*1000));

        if (days === 3) {
            bot.telegram.sendMessage(TARGET_GROUP_ID, `⚠️ <a href="tg://user?id=${userId}">你</a> 已入群 3 天，請盡快點擊「我已閱讀公告」`, { parse_mode: "HTML" });
        }
        if (days === 5) {
            bot.telegram.sendMessage(TARGET_GROUP_ID, `⚠️ <a href="tg://user?id=${userId}">你</a> 已入群 5 天，請立即完成公告閱讀`, { parse_mode: "HTML" });
        }
        if (days === 6) {
            bot.telegram.sendMessage(TARGET_GROUP_ID, `❗ <a href="tg://user?id=${userId}">你</a> 已入群 6 天，明天將被移除`, { parse_mode: "HTML" });
        }
        if (days >= 7) {
            bot.telegram.kickChatMember(TARGET_GROUP_ID, userId).catch(()=>{});
            bot.telegram.sendMessage(TARGET_GROUP_ID, `🚪 <a href="tg://user?id=${userId}">已被移除</a>（7 天未完成公告閱讀）`, { parse_mode: "HTML" });
        }
    }
}, 24*60*60*1000);

// ===== Bot 啟動 =====
bot.start((ctx) => ctx.reply(`${BOT_NAME} 已啟動`));
bot.launch().then(() => console.log(`${BOT_NAME} 運行中，監控群組 ${TARGET_GROUP_ID}`));
