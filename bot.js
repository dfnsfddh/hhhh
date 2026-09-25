const { Telegraf, Markup } = require('telegraf');

// تنظیمات اولیه
const BOT_TOKEN = '8951345745:AAERxK-zcvyC150lTUo2vvoO0UR15R3ZHDE';
const ADMIN_ID = 'batman1792'; // آیدی عددی یا یوزرنیم بدون @ مالک

const bot = new Telegraf(BOT_TOKEN);

// دیتابیس‌های حافظه موقت (برای پایداری دائمی می‌توانید از پایگاه داده‌های مثل SQLite یا MongoDB استفاده کنید)
const users = new Set();          // لیست تمام کاربران ربات
const blockedUsers = new Set();   // لیست کاربران بلاک شده
const sessions = {};              // ذخیره وضعیت مکالمه کاربران (حالت ناشناس یا پاسخ به پیام)

// تابع کمکی برای بررسی اینکه آیا کاربر ادمین است یا خیر
function isAdmin(userId, username) {
    return userId.toString() === ADMIN_ID || username === ADMIN_ID || username === `@${ADMIN_ID}`;
}

// دستور /start
bot.start(async (ctx) => {
    const userId = ctx.from.id.toString();
    const username = ctx.from.username;

    // ثبت کاربر در لیست
    users.add(userId);

    // بررسی اینکه آیا کاربر بلاک شده است یا خیر
    if (blockedUsers.has(userId)) {
        return ctx.reply('❌ شما توسط مدیریت از استفاده از ربات مسدود شده‌اید.');
    }

    // تنظیم حالت کاربر روی ارسال پیام ناشناس به Ghazl
    sessions[userId] = { state: 'SENDING_ANONYMOUS' };

    await ctx.reply(
        'در حال ارسال پیام ناشناس به Ghazl هستی 🌸\n\n' +
        'با خیال راحت هر پیامی دوست داشتی بده. این پیام بصورت کاملاً ناشناس ارسال میشه.\n' +
        'برای لغو کردن، گزینه /exit رو وارد کنید.',
        Markup.removeKeyboard()
    );
});

// دستور /exit برای خروج از حالت ارسال
bot.command('exit', (ctx) => {
    const userId = ctx.from.id.toString();
    if (sessions[userId]) {
        delete sessions[userId];
    }
    ctx.reply('❌ ارسال پیام ناشناس لغو شد.\nبرای شروع دوباره دستور /start رو بفرستید.');
});

// دستور /admin برای ورود به پنل مدیریت
bot.command('admin', async (ctx) => {
    const userId = ctx.from.id.toString();
    const username = ctx.from.username;

    if (!isAdmin(userId, username)) {
        return ctx.reply('❌ شما دسترسی به این بخش را ندارید.');
    }

    await ctx.reply(
        '🔧 **به پنل مدیریت ربات خوش آمدید:**',
        Markup.inlineKeyboard([
            [Markup.button.callback('📢 ارسال پیام همگانی', 'admin_broadcast')],
            [Markup.button.callback('👥 تعداد بلاکی‌ها', 'admin_blocked_count')],
            [Markup.button.callback('🔓 آزاد کردن تمام بلاکی‌ها', 'admin_unblock_all')]
        ])
    );
});

// مدیریت کلیک روی دکمه‌های شیشه‌ای پنل ادمین
bot.action('admin_broadcast', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isAdmin(userId, ctx.from.username)) return ctx.answerCbQuery('دسترسی غیرمجاز!');

    sessions[userId] = { state: 'WAITING_FOR_BROADCAST' };
    await ctx.answerCbQuery();
    await ctx.reply('📢 لطفاً پیام خود را برای ارسال همگانی به همه کاربران بفرستید (یا /cancel برای لغو):');
});

bot.action('admin_blocked_count', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isAdmin(userId, ctx.from.username)) return ctx.answerCbQuery('دسترسی غیرمجاز!');

    await ctx.answerCbQuery();
    await ctx.reply(`👥 تعداد کل کاربران بلاک شده: ${blockedUsers.size} نفر`);
});

bot.action('admin_unblock_all', async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isAdmin(userId, ctx.from.username)) return ctx.answerCbQuery('دسترسی غیرمجاز!');

    const count = blockedUsers.size;
    blockedUsers.clear();
    await ctx.answerCbQuery('انجام شد!');
    await ctx.reply(`🔓 تمام کاربران بلاک شده (${count} نفر) با موفقیت آزاد شدند.`);
});

// مدیریت دکمه‌های «بلاک» و «پاسخ» که برای مالک می‌آید
bot.action(/^block_(.+)$/, async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isAdmin(userId, ctx.from.username)) return ctx.answerCbQuery('دسترسی غیرمجاز!');

    const targetUserId = ctx.match[1];
    blockedUsers.add(targetUserId);

    await ctx.answerCbQuery('کاربر بلاک شد!');
    await ctx.editMessageReplyMarkup(
        Markup.inlineKeyboard([
            [Markup.button.callback('🚫 کاربر بلاک شد', 'noop')]
        ]).reply_markup
    );
    await ctx.reply(`🚫 کاربر با شناسه ${targetUserId} با موفقیت بلاک شد و دیگر نمی‌تواند از ربات استفاده کند.`);
});

bot.action(/^reply_(.+)$/, async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!isAdmin(userId, ctx.from.username)) return ctx.answerCbQuery('دسترسی غیرمجاز!');

    const targetUserId = ctx.match[1];
    sessions[userId] = { state: 'REPLYING_TO_USER', targetUserId: targetUserId };

    await ctx.answerCbQuery();
    await ctx.reply(`✍️ در حال پاسخ دادن به فرستنده این پیام هستی.\nمتن پاسخ خود را بفرست:`);
});

bot.action('noop', (ctx) => ctx.answerCbQuery());

// مدیریت تمام پیام‌های متنی ارسالی به ربات
bot.on('text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const username = ctx.from.username;
    const text = ctx.message.text;

    // اگر دستورات خاص بود نادیده بگیر تا تداخل ایجاد نشود
    if (text.startsWith('/')) return;

    // بررسی بلاک بودن کاربر عادی
    if (blockedUsers.has(userId) && !isAdmin(userId, username)) {
        return ctx.reply('❌ شما توسط مدیریت از استفاده از ربات مسدود شده‌اید.');
    }

    // ۱. حالت ارسال پیام همگانی توسط ادمین
    if (isAdmin(userId, username) && sessions[userId]?.state === 'WAITING_FOR_BROADCAST') {
        delete sessions[userId];
        let successCount = 0;
        
        await ctx.reply('⏳ در حال ارسال پیام همگانی...');
        for (const targetId of users) {
            try {
                await bot.telegram.sendMessage(targetId, text);
                successCount++;
            } catch (err) {
                // خطاهایی مثل بلاک شدن ربات توسط کاربر نادیده گرفته می‌شود
            }
        }
        return ctx.reply(`✅ پیام همگانی با موفقیت به ${successCount} کاربر ارسال شد.`);
    }

    // ۲. حالت پاسخ دادن ادمین به یک کاربر خاص
    if (isAdmin(userId, username) && sessions[userId]?.state === 'REPLYING_TO_USER') {
        const targetUserId = sessions[userId].targetUserId;
        delete sessions[userId];

        try {
            await bot.telegram.sendMessage(targetUserId, `💬 **پاسخ جدید از طرف مدیریت:**\n\n${text}`);
            return ctx.reply('✅ پاسخ شما با موفقیت به فرستنده ارسال شد.');
        } catch (err) {
            return ctx.reply('❌ ارسال پاسخ با خطا مواجه شد (احتمالاً کاربر ربات را بلاک کرده است).');
        }
    }

    // ۳. حالت ارسال پیام ناشناس کاربر به مالک (Ghazl)
    if (!isAdmin(userId, username)) {
        // پیدا کردن آیدی عددی مالک برای ارسال پیام ناشناس (اگر ADMIN_ID یوزرنیم باشد باید به آیدی عددی تبدیل شود یا به صورت مستقیم به یوزرنیم ارسال شود)
        // برای امنیت و ارسال مستقیم به مالک:
        try {
            await bot.telegram.sendMessage(
                `@${ADMIN_ID}`, // یا آیدی عددی مالک
                `📩 **پیام ناشناس جدید:**\n\n${text}`,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('🚫 بلاک', `block_${userId}`),
                        Markup.button.callback(' پاسخ ✍️', `reply_${userId}`)
                    ]
                ])
            );

            // پاسخ به کاربر فرستنده
            await ctx.reply('✅ پیام شما ارسال شد.\nبرای پیام دوباره دستور /start رو بفرستید.');
            // خروج از حالت ارسال خودکار پس از هر ارسال (اختیاری، جهت امنیت بیشتر)
            delete sessions[userId];
        } catch (err) {
            console.error(err);
            await ctx.reply('❌ خطا در ارسال پیام به مالک. لطفاً بعداً تلاش کنید.');
        }
    }
});

// راه‌اندازی ربات
bot.launch().then(() => {
    console.log('🤖 Anonymous Bot is running successfully!');
});

// مدیریت خروج ایمن
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
