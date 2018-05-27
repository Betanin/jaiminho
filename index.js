const Telegraf = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);
const axiosInstance = axios.create({
    baseURL: process.env.API_URL,
    timeout: 1000,
});
const maxLotation = process.env.MAX_LOTATION || 10;
const conversationsPool = [];
let monitor;
let alertar = true;

function addConversation(id, name, ctx) {
    if (!conversationsPool.some(item => item.id === id)) {
        conversationsPool.push({
            id,
            name,
            ctx,
        });    
        if (!monitor) {
            alertar = true;
            monitor = monitorParkingLotation(maxLotation, conversationsPool);                        
        }        
        monitor(true);
    }
}

function removeConversation(id) {
    const itemToRemove = conversationsPool.findIndex(item => item.id === id);
    conversationsPool.splice(itemToRemove, 1);
}

function broadcastMessage(message, chats) {
    chats.forEach(element => {
        element.ctx.reply(message.replace('[name]', element.name));
    });
}

function monitorParkingLotation(maxLotation, conversationsAlertPool) {

    const timeout = 10000;
    let interval;

    const monitorLoop = () => {
        if (interval) {
            clearInterval(interval);
        }
        interval = setInterval(() => {
            if (conversationsAlertPool.length === 0) {
                clearInterval(interval);
            } else {
                axiosInstance.get('/park/lotation')
                .then(response => {
                    const vehicles = JSON.parse(response.data).vehicles;
                    if (alertar && vehicles >= maxLotation) {
                        broadcastMessage(`Hey [name], o pátio está lotado tem ${vehicles} veículos lá agora!`, conversationsAlertPool);
                        alertar = false;
                    } else if (!alertar && vehicles >= maxLotation * 2) {
                        broadcastMessage(`Hey [name], o pátio está explodindo tem ${vehicles} veículos lá agora!`, conversationsAlertPool);
                    } else if (!alertar && vehicles < maxLotation) {
                        broadcastMessage(`Deu uma aliviada no pátio [name], tem ${vehicles} veículos lá agora!`, conversationsAlertPool);
                        alertar = true;
                    }
                })
                .catch(error => {
                    try {
                        if (typeof error === 'string') {
                            console.log(`Error: ${JSON.parse(error).message}`);
                        } else {
                            console.log(`Error: ${error.message}`);
                        }
                    } catch (error) {
                        console.log(`Error: ${error.message}`);
                    }
                    clearInterval(interval);
                })
            }
        }, timeout);
    }

    return (shouldRun) => {
        if (shouldRun) {
            monitorLoop();
        } else if (interval) {
            clearInterval(interval);
        }        
    }
    
}

bot.start((ctx) => {
    ctx.reply(`Olá ${ctx.update.message.from.first_name}`);
    ctx.reply('Digite /monitorar para que eu te avise se o pátio ficar muito cheio.');
});

bot.command('/sair', (ctx) => {
    ctx.leaveChat();
});

bot.command('/monitorar', (ctx) => {
    addConversation(ctx.message.chat.id, ctx.update.message.from.first_name, ctx);
    ctx.reply(`Pode deixar comigo ${ctx.update.message.from.first_name}, vou ficar de olho no pátio.`);
    ctx.reply('Digite /parar caso queira que eu pare de olhar o pátio pra você.');
});

bot.command('/parar', (ctx) => {
    removeConversation(ctx.message.chat.id);
    ctx.reply(`Ok ${ctx.update.message.from.first_name}, parei de olhar o pátio.`);
});

bot.command('/status', (ctx) => {
    axiosInstance.get('/park/lotation')
        .then(response => {
            const vehicles = JSON.parse(response.data).vehicles;
            if (vehicles <= 0) {
                ctx.reply('Não há nenhum veículo no pátio no momento');
            } else if (vehicles === 1) {
                ctx.reply('Há apenas 1 veículo no pátio no momento');
            } else {
                ctx.reply(`Tem ${vehicles} veículos no pátio no momento`);
            }            
        })
        .catch(error => {
            try {
                if (typeof error === 'string') {
                    console.log(`Error: ${JSON.parse(error).message}`);
                } else {
                    console.log(`Error: ${error.message}`);
                }
            } catch (error) {
                console.log(`Error: ${error.message}`);
            }            
            ctx.reply('Prefiro evitar a fadiga, me pergunte mais tarde');
        });
});

bot.on('text', (ctx) => {    
    ctx.reply('Preciso estudar para te entender melhor, mas prefiro evitar a fadiga...');
    ctx.reply('Então se quiser saber quantos veículos tem no pátio me mande /status');
    ctx.reply('Se quiser que eu fique de olho no pátio para você, me mande /monitorar');
});

bot.startPolling();