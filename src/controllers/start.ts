import { TContext, Markup } from 'telegraf';
import { Subscription, Subreddit } from '../models';
import { version } from '../../package.json';

export const showStartMenu = async (ctx: TContext) => {
  const update = ctx.callbackQuery?.data;
  const keyboard = [
    [Markup.callbackButton('Subscriptions', JSON.stringify({a: 'showSubscriptionsMenu' }))],
    [Markup.callbackButton('Settings', JSON.stringify({ a: 'showSettingsMenu' }))],
    [Markup.callbackButton('Info', JSON.stringify({ a: 'showInfo' }))],
  ];
  const markupKeyboard = Markup.inlineKeyboard(keyboard).extra();
  const userId = ctx.session.userId;
  const subsCount = await Subscription.countDocuments({ userId });
  let text = 'Main menu of NormReddit bot!';
  text += `\nYour subscriptions: ${subsCount}`;
  text += `\nBot version: ${version}`;
  return ctx[update ? 'editMessageText' : 'reply'](text, markupKeyboard);
};

export const showSubscriptionsMenu = async (ctx: TContext) => {
  const userId = ctx.session.userId;
  const keyboard = [
    [Markup.callbackButton('◀️ Back', JSON.stringify({ a: 'showStartMenu', p: 'update' }))],
  ];
  try {
    const susbscriptions = await Subscription.aggregate([{ $match: { userId } }, { $group: { _id: '$subredditId' } }]);
    if (susbscriptions.length > 0) {
      const subIds = susbscriptions.map(s => s._id);
      const subreddits = await Subreddit.find({ _id: { $in: subIds } });
      if (subreddits.length > 0) {
        for (const subreddit of subreddits) {
          keyboard.push([Markup.callbackButton(subreddit.name,
            JSON.stringify({ a: 'showCategoryMenuFromStart', id: subreddit._id }))]);
        }
        const markupKeyboard = Markup.inlineKeyboard(keyboard.reverse()).extra();
        return ctx.editMessageText('Subscriptions menu', markupKeyboard);
      }
    }
    const markupKeyboard = Markup.inlineKeyboard(keyboard).extra();
    return ctx.editMessageText('You don\'t have any subscriptions, use command /find or just send subreddit url', markupKeyboard);
  } catch (e) {
    console.log(e);
  }
};

export const showInfo = (ctx: TContext) => {
  ctx.answerCbQuery();
  ctx.reply('Sorry now we have no info for you, try again later ¯\\_(ツ)_/¯');
};
