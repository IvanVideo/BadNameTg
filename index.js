const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const app = express();
const port = 3000;
const usersData = [];

const admin = require('firebase-admin');


// Загрузите файл с ключом доступа и инициализируйте приложение Firebase
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


// Получите доступ к базе данных Firebase
const db = admin.firestore();
const collectionRef = db.collection('Users');
collectionRef.get()
    .then(snapshot => {
        snapshot.forEach(doc => {
            usersData.push(doc.data())
        });
    })
    .catch(error => {
        console.error('Ошибка при получении данных:', error);
    });


const clientID = '90283';
// const redirectURI = 'https://badnamerunningclub.web.app/';
const redirectURI = 'http://localhost:3000/auth/strava/callback';
const authorizeURL = `https://www.strava.com/oauth/authorize?client_id=${clientID}&redirect_uri=${redirectURI}&response_type=code&scope=read_all`;
const bot = new TelegramBot('6278180866:AAGraHvF6Rwfn6eldbeqTDvLiZvRrerCO_M', { polling: true });


//Сообщение после запуска бота
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const replyMarkup = {
        inline_keyboard: [
            [{ text: 'Хочу быть в рейтинге', callback_data: 'reply' }]
        ]
    };
    bot.sendMessage(chatId, 'Привет! Если хочешь чтобы мы включили тебя в рейтинговую систему Bad Name Running Club, разреши нам получать твои данные о тренировках из Strava', { reply_markup: replyMarkup });
});


//Даем ссылку и переводим на Strava
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;

    const message = `Для того, чтобы приложение BadNameRunningClub мог подключиться к Strava, нажмите на следующую ссылку: <a href="${authorizeURL}">Ссылка</a>`;
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
});


//Получение кода авторизации пользователя и обмен его на токен 
app.get('/auth/strava/callback', (req, res) => {
    const authorizationCode = req.query.code; // Получаем код авторизации из запроса
    // Обмен кода авторизации на токен доступа
    const tokenURL = 'https://www.strava.com/oauth/token';
    const clientID = 'YOUR_CLIENT_ID';
    const clientSecret = 'YOUR_CLIENT_SECRET';

    const data = {
        client_id: '90283',
        client_secret: '7d2951643ec5c405295d10fc9d2ebf972649b616',
        code: authorizationCode,
        grant_type: 'authorization_code'
    };

    axios.post(tokenURL, data)
        .then(response => {
            const accessToken = response.data.access_token;
            const refreshToken = response.data.refresh_token;

            // Получаем данные пользователя с уже полученным токеном
            const profileURL = 'https://www.strava.com/api/v3/athlete';
            axios.get(profileURL, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }).then(profileResponse => {
                // Получаем данные пользователя и сразу проверяем, есть ли он в базе. Если его нет в базе, то вносим
                const user = profileResponse.data;
                const checkId = user.id;
                const hasMatch = usersData.some(item => item.id === checkId);
                if (hasMatch) {
                    console.log('Есть объект с заданным id');
                } else {
                    const collectionRef = db.collection('Users');
                    // Создаю объект с данными пользователя
                    const data = {
                        id: user.id,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        sex: user.sex,
                        profile_medium: user.profile_medium,
                        profile: user.profile,
                    };
                    // Добавьте данные в коллекцию
                    collectionRef.add(data)
                        .then(docRef => {
                            console.log('Данные успешно добавлены с ID:', docRef.id);
                        })
                        .catch(error => {
                            console.error('Ошибка при добавлении данных:', error);
                        });
                }
            }).catch(error => {
                console.error('Ошибка при получении данных пользователя:', error);
            });
            // Отправляем ответ пользователю
            res.send('Авторизация в Strava успешно завершена!');
        })
        .catch(error => {
            console.error('Ошибка при обмене кода авторизации на токен доступа:', error);
        });
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
});
