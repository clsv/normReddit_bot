import { TContext } from 'telegraf';
import { User } from '../models';


export const userInit = async (ctx: TContext, next: Function) => {
  const userId = ctx.from.id;
  if (!ctx.session.language) {
    let user = await User.findById(userId);
    if (!user) {
      user = new User({
        _id: userId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      });
      user.save();
    }
    ctx.session.language = user.language;
    ctx.session.userId = userId;
    ctx.session.isPostButtonEnabled = user.isPostButtonEnabled;
    ctx.session.has18 = user.has18;
  }
  return next();
};

export const updateUserActivity = (ctx: TContext, next: Function) => {
  const userId = ctx.from.id;
  User.findByIdAndUpdate(userId, { $inc: { messageCount: 1 } }, (err, user) => {
    if (user === null) {
      console.log(`User #${userId} not found`);
      return;
    }
    if (err)
      console.log(err);
  });
  return next();
};
