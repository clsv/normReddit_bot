import Telegraf from 'telegraf';
import { TelegrafOptions } from 'telegraf/typings/telegraf';

const telegrafOptions: TelegrafOptions = {};

if (process.env.PROXY_S5_ENABLE === 'true') {
  const SocksAgent = require('socks-proxy-agent');
  const socksAgent = new SocksAgent({
    host: process.env.PROXY_S5_IP,
    port: process.env.PROXY_S5_PORT,
    username: process.env.PROXY_S5_USER,
    password: process.env.PROXY_S5_PASS,
  });
  telegrafOptions.telegram = {
    agent: socksAgent,
  };
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN, telegrafOptions);

export const startBot = () => {
  if (process.env?.PROD) {
    bot.telegram
      .setWebhook('URL/PATH')
      .then(async () => {
        await bot.startWebhook('/PATH', undefined, 5000);
        const webhookStatus = await bot.telegram.getWebhookInfo();
        console.log('Bot webhook running', webhookStatus);
      })
      .catch(err => console.log('Bot launch error', err));
  } else {
    bot.telegram
      .deleteWebhook()
      .then(async () => {
        bot.startPolling();
        console.log('Bot pooling is running');
      })
      .catch(err => console.log('Bot launch error', err));
  }
};

export default bot;
