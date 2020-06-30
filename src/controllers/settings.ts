import { User } from '../models';
import { TContext, Markup } from 'telegraf';


export const showSettingsMenu = async (ctx: TContext) => {
  const userId = ctx.session.userId;
  const user = await User.findById(userId);
  const getShowHideText = (param: boolean) => {
    return param ? '✅ Show' : '❌ Hide';
  };
  const keyboard = [
    [Markup.callbackButton(`${getShowHideText(user.isVideoWithSoundEnabled)} videos with sound`, JSON.stringify({ a: 'toggleParam', p: 'isVideoWithSoundEnabled' }))],
    [Markup.callbackButton(`${getShowHideText(user.isNSFWEnabled)} NSFW Posts 🔞`, JSON.stringify({ a: 'toggleParam', p: 'isNSFWEnabled' }))],
    [Markup.callbackButton(`${getShowHideText(user.isRemoteVideoEnabled)} remotes videos`, JSON.stringify({ a: 'toggleParam', p: 'isRemoteVideoEnabled' }))],
    [Markup.callbackButton(`${getShowHideText(user.isPostButtonEnabled)} "Open post" button`, JSON.stringify({ a: 'toggleParam', p: 'isPostButtonEnabled' }))],
    [Markup.callbackButton('◀️ Back', JSON.stringify({ a: 'showStartMenu', p: 'update' }))],
  ];
  const markupKeyboard = Markup.inlineKeyboard(keyboard).extra();
  return ctx.editMessageText('Settings', markupKeyboard);
};

export const toggleParam = async (ctx: TContext) => {
  const userId = ctx.session.userId;
  const data = JSON.parse(ctx.callbackQuery.data);
  const param = data.p;
  const user = await User.findById(userId);
  if (user === null) return undefined;
  const value = !user.get(param);
  user.set(param, value);
  await user.save();
  if (param === 'isPostButtonEnabled') {
    ctx.session.isPostButtonEnabled = value;
  }
  return showSettingsMenu(ctx);
};
