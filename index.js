// ========================================
// 台灣🔞成人交流深夜食堂💎-👶新生學生會- 完整 Bot
// ========================================

const { Telegraf, Markup } = require('telegraf');
const BOT_NAME = "食堂鎮暴秩序部隊 🤖";
const BOT_TOKEN = "8316532268:AAGT-82-IrAjmQdcsYHHLs_9H510h6ilebM"; // 你之後可以自行更換
const TARGET_GROUP_ID = -1003742241522;
const ADMIN_IDS = [8165338666, 8392427662];
const GOOGLE_FORM_LINK = "https://docs.google.com/forms/d/e/1FAIpQLSfjXx5H0b402yqpAjnSluQHse59qL2GO5zup0pINR5Mau3C0w/viewform?usp=sharing";

// ===== 初始化 Bot =====
const bot = new Telegraf(BOT_TOKEN);

// ===== JSON 儲存資料 =====
const fs = require('fs');
const DATA_FILE = 'data.json';
let data = { joinTime: {}, readStatus: {}, formStatus: {}, points: {}, violationCount: {}, ghostStatus: {} };

// 讀取資料
if (fs.existsSync(DATA_FILE)) {
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

// ===== 表單私訊流程 =====
bot.on("text", async (ctx) => {
    if (ctx.chat.type !== "private") return;

    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    if (text === "已填寫") {
        data.formStatus[userId] = true;
        save();
        await ctx.reply("📬 已收到你的表單填寫通知，請等待管理員審核");
    }
});

// ===== 外部連結偵測 =====
const ALLOWED_LINKS = [
    "t.me/你的群組ID",
    "t.me/+你的邀請碼"
];
function containsURL(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return urlRegex.test(text);
}
bot.on("message", async (ctx, next) => {
    const msg = ctx.message;
    const text = msg.text || "";
    const userId = msg.from.id;

    if (ADMIN_IDS.includes(userId)) return next();

    if (containsURL(text)) {
        let safe = false;
        for (let link of ALLOWED_LINKS) {
            if (text.includes(link)) safe = true;
        }
        if (!safe) {
            await ctx.deleteMessage().catch(()=>{});
            await ctx.reply(`🚫 <a href="tg://user?id=${userId}">你</a> 禁止張貼外部連結，已被移除`, { parse_mode: "HTML" });
            await bot.telegram.kickChatMember(TARGET_GROUP_ID, userId);
            return;
        }
    }
    return next();
});

// ===== 禁止非管理員邀請成員 =====
bot.on("chat_member", async (ctx) => {
    const dataCM = ctx.update.chat_member;
    const newMember = dataCM.new_chat_member;
    const inviter = dataCM.from;

    if (newMember && newMember.status === "member") {
        if (!ADMIN_IDS.includes(inviter.id)) {
            await bot.telegram.kickChatMember(TARGET_GROUP_ID, inviter.id);
            await ctx.reply(`🚫 <a href="tg://user?id=${inviter.id}">你</a> 未經允許邀請成員 → 已被移除`, { parse_mode: "HTML" });
        }
    }
});

// ===== 違規次數累積 =====
function handleViolation(ctx, userId) {
    if (!data.violationCount[userId]) data.violationCount[userId] = 0;
    data.violationCount[userId]++;
    save();

    const count = data.violationCount[userId];

    if (count === 1) {
        ctx.reply(`⚠️ <a href="tg://user?id=${userId}">你</a> 第 1 次違規（警告）`, { parse_mode: "HTML" });
    }
    if (count === 3) {
        ctx.reply(`⛔ <a href="tg://user?id=${userId}">你</a> 第 3 次違規 → 禁言 3 天`, { parse_mode: "HTML" });
        bot.telegram.restrictChatMember(TARGET_GROUP_ID, userId, {
            until_date: Math.floor(Date.now()/1000) + 3*24*60*60,
            can_send_messages: false
        });
    }
    if (count >= 5) {
        ctx.reply(`🚪 <a href="tg://user?id=${userId}">你</a> 第 5 次違規 → 已被移除`, { parse_mode: "HTML" });
        bot.telegram.kickChatMember(TARGET_GROUP_ID, userId);
    }
}

// ===== 積分系統 =====
function addPoints(userId, amount) {
    if (!data.points[userId]) data.points[userId] = 0;
    data.points[userId] += amount;
    save();
}

// ===== 幽靈偵測 =====
setInterval(() => {
    const now = Date.now();
    for (let userId in data.ghostStatus) {
        const lastActive = data.ghostStatus[userId];
        const days = Math.floor((now - lastActive) / (24*60*60*1000));
        if (days === 7) {
            bot.telegram.sendMessage(TARGET_GROUP_ID, `⚠️ <a href="tg://user?id=${userId}">你</a> 7 天未互動，請活躍`, { parse_mode: "HTML" });
        }
        if (days >= 10) {
            bot.telegram.kickChatMember(TARGET_GROUP_ID, userId);
            bot.telegram.sendMessage(TARGET_GROUP_ID, `🚪 <a href="tg://user?id=${userId}">你</a> 10 天未互動，已被移除`, { parse_mode: "HTML" });
        }
    }
}, 24*60*60*1000);

// ===== Bot 啟動 =====
bot.start((ctx) => ctx.reply(`${BOT_NAME} 已啟動`));
bot.launch().then(() => console.log(`${BOT_NAME} 運行中，監控群組 ${TARGET_GROUP_ID}`));

// ===== 管理員指令 =====
bot.command('check', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const args = ctx.message.text.split(" ");
    const userId = args[1];
    if (!userId) return ctx.reply("請輸入 userId");
    ctx.reply(`使用者 ${userId} 積分：${data.points[userId] || 0}`);
});

bot.command('list', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    let result = "成員積分列表：\n";
    for (let uid in data.points) {
        result += `ID:${uid} → ${data.points[uid]} 分\n`;
    }
    ctx.reply(result);
});

bot.command('addpoints', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const args = ctx.message.text.split(" ");
    const userId = args[1];
    const amount = parseInt(args[2]);
    if (!userId || isNaN(amount)) return ctx.reply("格式錯誤：/addpoints <userId> <amount>");
    addPoints(userId, amount);
    ctx.reply(`已為 ${userId} 加 ${amount} 分`);
});

bot.command('deduct', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const args = ctx.message.text.split(" ");
    const userId = args[1];
    const amount = parseInt(args[2]);
    if (!userId || isNaN(amount)) return ctx.reply("格式錯誤：/deduct <userId> <amount>");
    if (!data.points[userId]) data.points[userId] = 0;
    data.points[userId] -= amount;
    save();
    ctx.reply(`已為 ${userId} 扣 ${amount} 分`);
});

bot.command('notfilled', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    let result = "未填寫名單：\n";
    for (let uid in data.readStatus) {
        if (!data.readStatus[uid]) result += `ID:${uid}\n`;
    }
    ctx.reply(result);
});

bot.command('rules', (ctx) => {
    ctx.reply("請查看群組置頂公告");
});

bot.command('ghostscan', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    let result = "幽靈成員：\n";
    const now = Date.now();
    for (let uid in data.ghostStatus) {
        const lastActive = data.ghostStatus[uid];
        const days = Math.floor((now - lastActive) / (24*60*60*1000));
        if (days >= 7) result += `ID:${uid}\n`;
    }
    ctx.reply(result);
});

bot.command('adminhelp', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    ctx.reply(`
管理員指令表：
/check <userId> → 查某個人的積分
/list → 查全部成員
/addpoints <userId> <amount> → 手動加分
/deduct <userId> <amount> → 手動扣分
/notfilled → 查誰還沒標記「已填寫」
/rules → 推送群規
/ghostscan → 幽靈掃描（檢查誰 7 天沒互動）
/adminhelp → 一鍵查詢完整指令表
    `);
});
