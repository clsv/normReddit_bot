import { Subreddit, Subscription } from '../models';
import { TContext, Markup } from 'telegraf';
import { resize } from 'easyimage';
import contentType from '../models/contentType';
import categoryType from '../models/categoryType';
import { getEnumLength } from '../utils/enums';
import { controlSubscriptionCount } from '../utils/user';
import { ISubreddit } from '../models';
import downloadFile, { getRemoteFileParams } from '../utils/donwload';
import fs from 'fs';


export const updateMessage = (ctx: TContext, buttons: Array<any>) => {
  const { message } = ctx.update.callback_query;
  const keyboard = Markup.inlineKeyboard(buttons);
  if (message.caption) {
      return ctx.editMessageCaption(message.caption, keyboard);
  } else {
    return ctx.editMessageText(message.text, { reply_markup: keyboard, disable_web_page_preview: true });
  }
};

const showContentTypeMenu = (ctx: TContext, subredditId: string, category: number) => {
  const userId = ctx.from.id;
  Subscription.find({ userId: userId, subredditId, category }, (err, res) => {
    if (err) return console.log('Subscription find error');
    const buttons = [];
    const contentTypeLength = getEnumLength(contentType);
    for (let i = 0; i < contentTypeLength; i += 1) {
      const subscription = res.filter(e => e.type === i);
      const isSubsribed = subscription.length !== 0;
      const categoryButtons = [];
      categoryButtons.push(Markup.callbackButton(`${contentType[i]}(${categoryType[category]}) ${isSubsribed ? '❌Unsubscribe' : '✅Subscribe'}`,
        JSON.stringify({ a: isSubsribed ? 'unsubscribe' : 'subscribe', id: subredditId, type: i, category }))
      );
      if (isSubsribed) {
        const { _id, minRating } = subscription[0];
        categoryButtons.push(Markup.callbackButton(`Min.Rating: ${minRating || 0}`,
          JSON.stringify({
            a: 'toggleRating',
            id: _id,
            r: minRating || 0
          })));
      }
      buttons.push(categoryButtons);
    }
    buttons.push([Markup.callbackButton('◀️Back', JSON.stringify({ a: 'contentTypeBack', id: subredditId }))]);
    updateMessage(ctx, buttons);
  });
  return ctx.answerCbQuery();
};

export const contentTypeBackAction = async (ctx: TContext, ) => {
  const data = JSON.parse(ctx.callbackQuery.data);
  const userId = ctx.session.userId;
  const mainKeyboard = await getCategoryButtons(data.id, userId);
  ctx.answerCbQuery();
  return updateMessage(ctx, mainKeyboard);
};

export const getCategoryButtons = async (subredditId: string, userId: number) => {
  const action = { a: 'showContentType', id: subredditId };
  const subscriptions = await Subscription.find({ userId, subredditId });
  const subsCount = {
    hot: subscriptions.filter(e => e.category === categoryType.Hot).length,
    top: subscriptions.filter(e => e.category === categoryType.Top).length,
    new: subscriptions.filter(e => e.category === categoryType.New).length
  };
  const keyboard = [
    [Markup.callbackButton(`🔥Hot (${subsCount.hot})`,
      JSON.stringify(Object.assign(action, { t: categoryType.Hot })))],
    [Markup.callbackButton(`🏆Top (${subsCount.top})`,
      JSON.stringify(Object.assign(action, { t: categoryType.Top })))],
    [Markup.callbackButton(`🆕New (${subsCount.new})`,
      JSON.stringify(Object.assign(action, { t: categoryType.New })))],
  ];
  if (subscriptions.length > 0) {
    keyboard.push([Markup.callbackButton('♻️Unsubscribe all', JSON.stringify({ a: 'unsubscribeAll', id: subredditId }))]);
  }
  keyboard.push([Markup.callbackButton('🚪Close', JSON.stringify({ a: 'closeCategoryMenu' }))]);
  return keyboard;
};

export const showCategoryMenu = async (ctx: TContext, subreddit: ISubreddit) => {
  const text = `title: ${subreddit.title}\nurl: https://reddit.com${subreddit.url}\nsusbcribers: ${subreddit.subscribers?.toLocaleString() || 'error'}`;
  const userId = ctx.session.userId;
  const keyboard = Markup.inlineKeyboard(await getCategoryButtons(subreddit._id, userId));
  if (subreddit.icon && subreddit.icon.length > 0) {
    let icon: any = subreddit.icon;
    if (!subreddit.iconId) {
      const iconParams = await getRemoteFileParams(subreddit.icon, 'image');
      if (iconParams.width < 250) {
        const orgIconPath = `./tmp/${subreddit.name}_org.png`;
        const newIconPath = `./tmp/${subreddit.name}_new.png`;
        const result = await downloadFile(subreddit.icon, orgIconPath);
        if (result) {
          try {
            await resize({ src: orgIconPath, dst: newIconPath, width: 300 });
            icon = { source: fs.createReadStream(newIconPath) };
          } catch (e) {
            console.log('Convert ICON Error: ', e);
          }
        }
      }
    } else {
      icon = subreddit.iconId;
    }
    const options = Object.assign(keyboard.extra(), { caption: text });
    return ctx.replyWithPhoto(icon, options).then(result => {
      if (subreddit.iconId) return;
      const file_id = result?.photo.pop().file_id;
      if (file_id) {
        subreddit.iconId = file_id;
        subreddit.save();
      }
    });
  } else {
    return ctx.reply(text, { reply_markup: keyboard, disable_web_page_preview: true });
  }
};

export const unsubscribeAllAction = async (ctx: TContext) => {
  const userId = ctx.from.id;
  const { id: subredditId } = JSON.parse(ctx.callbackQuery.data);
  const result = await Subscription.deleteMany({ userId, subredditId });
  if (result?.deletedCount > 0) {
    const { deletedCount } = result;
    Subreddit.findByIdAndUpdate(subredditId, { $inc: { subscriberCount: -deletedCount } }, (err, res) => {
      controlSubscriptionCount(userId, 'down', result.deletedCount);
    });
  }
  ctx.answerCbQuery();
  const mainKeyboard = await getCategoryButtons(subredditId, userId);
  return updateMessage(ctx, mainKeyboard);

};

export const showContentTypeAction = (ctx: TContext) => {
  const subscribeData = JSON.parse(ctx.callbackQuery.data);
  Subreddit.findById(subscribeData.id, (sErr, sRes) => {
    if (sErr !== null || sRes === null) return ctx.reply('Subbreddit not found!');
    showContentTypeMenu(ctx, subscribeData.id, subscribeData.t);
  });
  return ctx.answerCbQuery();
};

export const subscribeAction = (ctx: TContext) => {
  const userId = ctx.from.id;
  const { id: subredditId, type, category } = JSON.parse(ctx.callbackQuery.data);
  new Subscription({
    userId,
    subredditId,
    type,
    category
  }).save((err, res) => {
    if (err) {
      console.log(err);
    } else {
      Subreddit.findByIdAndUpdate(subredditId, { $inc: { subscriberCount: 1 } }, (err, res) => {
        showContentTypeMenu(ctx, subredditId, category);
        controlSubscriptionCount(userId, 'up');
      });
    }
  });
  return ctx.answerCbQuery();
};

export const unsubscribeAction = async (ctx: TContext) => {
  const { id: subredditId, type, category } = JSON.parse(ctx.callbackQuery.data);
  const userId = ctx.from.id;
  Subscription.findOneAndRemove({ subredditId, userId, type, category }, (err, res) => {
    if (err) {
      console.log(err);
    } else {
      Subreddit.findByIdAndUpdate(subredditId, { $inc: { subscriberCount: -1 } }, (err, res) => {
        showContentTypeMenu(ctx, subredditId, category);
        controlSubscriptionCount(userId, 'down');
      });
    }
  });
  return ctx.answerCbQuery();
};

export const toggleRating = async (ctx: TContext) => {
  const { id, r } = JSON.parse(ctx.callbackQuery.data);
  let rating = Number(r);
  if (rating < 300) {
    rating += 25;
  } else {
    rating = 0;
  }
  Subscription.findByIdAndUpdate(id, { minRating: rating }, (err, res) => {
    if (err) {
      console.log('Toggle rating error');
      return;
    }
    const { subredditId, category } = res;
    return showContentTypeMenu(ctx, subredditId, category);
  });
};

export const showCategoryMenuFromStart = async (ctx: TContext) => {
  const { id } = JSON.parse(ctx.callbackQuery.data);
  const subreddit = await Subreddit.findById(id);
  if (subreddit === null) return ctx.answerCbQuery('Subreddit not found');
  showCategoryMenu(ctx, subreddit);
  return ctx.answerCbQuery();
};

export const closeCategoryMenu = (ctx: TContext) => {
  ctx.deleteMessage();
};

