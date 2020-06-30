import { Subscription, Post, IPost, PostToUser, Subreddit, User } from '../models';
import { Markup } from 'telegraf';
import bot from '../telegram';
import contentType from '../models/contentType';
import downloadFile, { getRemoteFileParams, removeFile } from '../utils/donwload';
import { InputFile, InlineKeyboardButton } from 'telegraf/typings/telegram-types';

enum ImageStatus {
  Ok,
  BigSize,
  NeedDownload,
  Error,
}

const incrementPostCount = (userId: number) => {
  User.findByIdAndUpdate(userId, { $inc: { postCount: 1 } }).exec();
};

export const controlSubscriptionCount = (userId: number, type: 'up' | 'down' = 'up', count: number = 1) => {
  User.findByIdAndUpdate(userId, { $inc: { subscriptionCount: type === 'up' ? count : -count } }).exec();
};

const getImageStatus = async (imageUrl: string): Promise<ImageStatus> => {
  const remoteImageParams = await getRemoteFileParams(imageUrl);
  const { fileSize, width, height } = remoteImageParams;
  if (fileSize === -1) {
    return ImageStatus.Error;
  }
  if (width > 4500 || height > 4500 || fileSize > 5242880) {
    return ImageStatus.BigSize;
  }
  if (fileSize > 1048576) {
    return ImageStatus.NeedDownload;
  }
  return ImageStatus.Ok;
};

type keyboardType = 'LinkOnly' | 'ExternalVideo' | 'Sound' | 'Video' | 'both';
export const getInlineKeyboard = (type: keyboardType = 'both', postButton: boolean, postId: string, url?: string) => {
  const buttons = [];
  const external = [];
  const internal = [];
  if (type === 'Video' || type === 'both') {
    internal.push(Markup.callbackButton('🎥 Show only video',
      JSON.stringify({ a: 'showVideo', postId, withSound: false })));
  }
  if (type === 'Sound' || type === 'both') {
    internal.push(Markup.callbackButton('🔊 Show video + audio',
      JSON.stringify({ a: 'showVideo', postId, withSound: true })));
  }
  if (type === 'ExternalVideo') {
    external.push(Markup.urlButton('🎬 Open video', url));
  }
  if (postButton) {
    external.push(Markup.urlButton('🔗 Open post', `https://reddit.com/comments/${postId}/`));
  }
  buttons.push(internal, external);
  return Markup.inlineKeyboard(buttons);
};

const secondsToTime = (seconds: number): string => {
  let start = 11;
  let end = 8;
  if (seconds < 3600) {
    start = 14;
    end = 5;
  }
  const date = new Date(0);
  date.setSeconds(seconds);
  const timeString = date.toISOString().substr(start, end);
  return timeString;
};

const sendPost = async (userId: number, post: IPost, postButton: boolean, last: boolean) => {
  if (last) {
    isSubscInProgress = false;
  }
  const {
    _id: postId,
    author,
    subredditId,
    caption,
    num_comments,
    original,
    parentCaption,
    over_18,
    text,
    score,
    type,
    hasSound,
    videoFileSize,
    videoDuration,
  } = post;
  const subreddit = await Subreddit.findById(subredditId);
  let messageText = `${over_18 ? '🔞' : ''}${caption.escapeHtml()}\n${parentCaption ? `Original: ${parentCaption}\n` : ''}`;
  messageText += `author: <a href='https://reddit.com/u/${author}'>${author}</a>\n`;
  messageText += `post: <a href='https://reddit.com/comments/${post._id}/'>link</a>\n`;
  messageText += `subreddit: r/<a href='https://reddit.com${subreddit.url}'>${subreddit.name}</a>\n`;
  messageText += `comments: ${num_comments}\n`;
  messageText += `rating: ${score}`;
  messageText += text.length < 100 ? `${text.length > 0 ? `\n${text}` : ''}` : `\nText lenght: ${text.length} chars`;
  if (original) {
    messageText += '\n✅original content';
  }
  if (type === contentType.Video) {
    messageText += '\n#video';
    if (videoFileSize > 0) {
      messageText += `\nfile size: ~${Math.round(videoFileSize / 1048576)} mb`;
    }
    if (videoDuration > 0) {
      messageText += `\nduration: ${secondsToTime(videoDuration)}`;
    }
  }
  if (type === contentType.Text) {
    const keyboard = getInlineKeyboard('LinkOnly', postButton, postId);
    return bot.telegram.sendMessage(userId, messageText,
      { parse_mode: 'HTML', reply_markup: keyboard, disable_web_page_preview: true }).then((result) => {
        new PostToUser({ userId, postId, subredditId }).save();
        incrementPostCount(userId);
      });
  }
  let image: InputFile = post.previewImageId;
  let filePath: string = '';
  if (!post.previewImageId || post.previewImageUrl) {
    image = post.previewImageUrl;
    const imageStatus = await getImageStatus(image);
    if (imageStatus === ImageStatus.Error || imageStatus === ImageStatus.BigSize) {
      post.type = contentType.Text;
      post.text += `\nError: Preview ${ImageStatus[imageStatus]}`;
      sendPost(userId, post, postButton, last);
      return;
    }
    if (imageStatus === ImageStatus.NeedDownload) {
      filePath = `./tmp/${postId}.jpg`;
      const result = await downloadFile(post.previewImageUrl, filePath);
      if (!result) {
        console.log('Error downloading preview sending without image');
        post.text += '\nError: I can\'t download preview';
        sendPost(userId, post, postButton, last);
        return;
      }
      image = { source: filePath };
    }
  }
  let keyboard;
  if (post.type === contentType.Video) {
    if (post.isRemoteVideo) {
      keyboard = getInlineKeyboard('ExternalVideo', postButton, postId, post.videoUrl);
    } else {
      keyboard = getInlineKeyboard(hasSound ? 'both' : 'Video', postButton, postId);
    }
  } else {
    keyboard = getInlineKeyboard('LinkOnly', postButton, postId);
  }
  bot.telegram.sendPhoto(userId, image, { caption: messageText, parse_mode: 'HTML', reply_markup: keyboard }).then(result => {
    new PostToUser({ userId, postId, subredditId }).save();
    if (post.previewImageId) return;
    const file_id = result?.photo.pop().file_id;
    if (file_id) {
      post.previewImageId = file_id;
      post.save();
    }
    if (filePath.length > 0) removeFile(filePath);
    incrementPostCount(userId);
  }).catch(err => {
    if (filePath.length > 0) removeFile(filePath);
    console.log(postId, err);
  });
};


let isSubscInProgress = false;
export const processSubscriptions = () => {
  if (isSubscInProgress) return;
  console.log('running subscription check');
  Subscription.find(async (err, res) => {
    isSubscInProgress = true;
    let timeout = 0;
    let postsCount = 0;
    const sixHoursAgo = new Date(new Date().setHours(new Date().getHours() - 12));
    for (let i = 0, len = res.length; i < len; i += 1) {
      const isLastSub = (i === len - 1);
      const { userId, subredditId, type, category, minRating } = res[i];
      const user = await User.findById(userId);
      const sendedPosts = await PostToUser.find({ userId, subredditId, createdAt: { $gte: sixHoursAgo } });
      const sendedPostsId = sendedPosts.map(e => e.postId);

      const postsToSend = await Post.find({ subredditId, type: type !== 0 ? type : { $ne: type }, category, _id: { $nin: sendedPostsId }, createdAt: { $gte: sixHoursAgo }, score: { $gte: minRating } });
      const postLen = postsToSend.length;
      console.log(`need to send ${postLen} posts`);
      if (isLastSub && postLen === 0) isSubscInProgress = false;
      if (postLen > 0) {
        postsCount += postLen;
        for (let k = 0; k < postLen; k += 1) {
          const isLastPost = isLastSub && (k === postLen - 1);
          const { isRemoteVideo, over_18, hasSound } = postsToSend[k];

          if ((isRemoteVideo && !user.isRemoteVideoEnabled) ||
            (over_18 && !user.isNSFWEnabled) ||
            (hasSound && !user.isVideoWithSoundEnabled)) {
            isSubscInProgress = !isLastPost;
            continue;
          }
          setTimeout(sendPost, timeout, userId, postsToSend[k], user.isPostButtonEnabled, isLastPost);
          timeout += 500;
        }
      }
    }
    if (res.length === 0 || postsCount === 0) isSubscInProgress = false;
  });
};
