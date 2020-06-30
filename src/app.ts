require('dotenv').config();
import './utils/string';
import mongoose from 'mongoose';
import { TContext, session } from 'telegraf';
import bot, { startBot } from './telegram';
import { findSubreddit, updateAllPosts, updateSubreddits } from './utils/reddit';

import { userInit, updateUserActivity } from './middlewares/user';
import {
  showContentTypeAction,
  contentTypeBackAction,
  unsubscribeAction,
  unsubscribeAllAction,
  subscribeAction,
  showCategoryMenu,
  toggleRating,
  showCategoryMenuFromStart,
  closeCategoryMenu
} from './controllers/subscribe';
import { showVideoAction } from './controllers/video';

import { processSubscriptions } from './utils/user';
import {
  showStartMenu,
  showSubscriptionsMenu,
  showInfo
} from './controllers/start';
import { showSettingsMenu } from './controllers/settings';

import { toggleParam } from './controllers/settings';

mongoose.connect(process.env.MONGO, {
  useNewUrlParser: true,
  useFindAndModify: false,
  useCreateIndex: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('error', err => {
  process.exit(1);
});



mongoose.connection.on('open', () => {
  bot.use(session());
  bot.use(userInit);
  bot.use(updateUserActivity);
  startBot();

  bot.use(async (ctx: TContext, next: Function) => {
    if (!ctx.message || !ctx.message.text) return next();
    const messageText = ctx.message.text;
    const matches = messageText.match(/\/find\s+(\w+)|https\:\/\/(?:www\.|)reddit\.com\/r\/(\w+)\/?/);
    if (matches === null) return next();
    const searchName = matches[1] || matches[2];
    const subreddit = await findSubreddit(searchName);
    if (subreddit === undefined) {
      ctx.reply(`Сорян ${searchName} не найдено`);
      return next();
    }
    console.log(subreddit);
    return showCategoryMenu(ctx, subreddit);
  });
  bot.command(['start', 'menu'], showStartMenu);
  bot.action(/"showStartMenu"/, showStartMenu);
  bot.action(/"showSubscriptionsMenu"/, showSubscriptionsMenu);
  bot.action(/"toggleRating"/, toggleRating);
  bot.action(/"showCategoryMenuFromStart"/, showCategoryMenuFromStart);

  bot.action(/"closeCategoryMenu"/, closeCategoryMenu);
  bot.action(/"showSettingsMenu"/, showSettingsMenu);
  bot.action(/"toggleParam"/, toggleParam);
  bot.action(/"showInfo"/, showInfo);
  bot.action(/"showContentType"/, showContentTypeAction);
  bot.action(/"subscribe"/, subscribeAction);
  bot.action(/"unsubscribeAll"/, unsubscribeAllAction);
  bot.action(/"unsubscribe"/, unsubscribeAction);
  bot.action(/"contentTypeBack"/, contentTypeBackAction);
  bot.action(/"showVideo"/, showVideoAction);


  updateAllPosts();
  processSubscriptions();
  setInterval(updateAllPosts, 600000); // Обновление постов раз в 10 минут
  setInterval(processSubscriptions, 120000); // Отправка постов пользователям раз в 2 минуты
  setInterval(updateSubreddits, 10800000); // Обновление инфы о subreddit'ах раз в 3 часа

});