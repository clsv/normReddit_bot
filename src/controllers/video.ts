import { TContext } from 'telegraf';
import { Post, IPost } from '../models';
import { Message, InputMediaVideo, MessageEntity } from 'telegram-typings';
import Ffmpeg from 'fluent-ffmpeg';
import downloadFile, { removeFile } from '../utils/donwload';
import { getInlineKeyboard } from '../utils/user';
import fs from 'fs';

const markupMessage = (message: string, entitys: MessageEntity[]): string => {
  let adjOffset = 0;
  for (const entity of entitys) {
    const { length, offset, type } = entity;
    let starTag, endTag: string = '';
    switch (type) {
      case 'bold':
        starTag = '<b>';
        endTag = '</b>';
        message = message.insertTag(adjOffset + offset, length, starTag, endTag);
        adjOffset += starTag.length + endTag.length;
        break;
      case 'text_link':
        starTag = `<a href="${entity.url}">`;
        endTag = '</a>';
        message = message.insertTag(adjOffset + offset, length, starTag, endTag);
        adjOffset += starTag.length + endTag.length;
        break;
    }
  }
  return message;
};

interface MediaVideo extends InputMediaVideo {
  media: string | any;
}

export const showVideoAction = async (ctx: TContext) => {
  const { caption, caption_entities } = ctx.update.callback_query.message;
  const { postId, withSound } = JSON.parse(ctx.callbackQuery.data);
  const post = await Post.findById(postId);
  if (post === null) {
    console.log(`${postId} post not found`);
    return ctx.answerCbQuery('post not found');
  }
  const mediaData: MediaVideo = {
    type: withSound ? 'video' : 'animation',
    media: post.videoId ? post.videoId : post.videoUrl,
    caption: markupMessage(caption, caption_entities),
    supports_streaming: true,
    parse_mode: 'HTML'
  };
  let hasSound = withSound;
  if (withSound) {
    if (!post.videoWithSoundId) {
      try {
        if (ctx.session.userId !== Number(process.env.ADMIN_ID)) {
          return ctx.answerCbQuery('Sorry this function is only for VIP users');
        }
        ctx.answerCbQuery('trying add sound to video');
        const newFile = `./tmp/${postId}_withaudio.mp4`;
        mediaData.media = { source: newFile };
        const audioFile = `./tmp/${postId}.mp3`;
        if (!fs.existsSync(audioFile)) {
          console.log('downloading audio');
          const result = await downloadFile(post.videoUrl.replace(/DASH_.+/, 'audio'), audioFile);
          if (!result) {
            throw new Error('download audio error');
          }
        }

        const videoFile = `./tmp/${post._id}.mp4`;
        if (!fs.existsSync(videoFile)) {
          console.log('downloading video');
          const result = await downloadFile(post.videoUrl, videoFile);
          if (!result) {
            removeFile(audioFile);
            throw new Error('download video error');
          }
        }

        console.log('Trying add sound to video');
        Ffmpeg({ source: videoFile })
          .addInput(audioFile)
          .toFormat('mp4')
          .saveToFile(newFile)
          .on('progress', (p) => {
            console.log('Processing: ' + p.percent + '% done');
          }).on('end', () => {
            showVideo(ctx, post, mediaData, hasSound).then(result => {
              removeFile(videoFile);
              removeFile(audioFile);
              removeFile(newFile);
            });
          }).run();
        return;
      } catch (e) {
        console.log(e);
        hasSound = false;
      }
    } else {
      mediaData.media = post.videoWithSoundId;
    }
  } /* else {
    ctx.answerCbQuery('media loading please wait');
  } */
  return showVideo(ctx, post, mediaData, hasSound);
};


const showVideo = (ctx: TContext, post: IPost, data: InputMediaVideo, withSound: boolean = false): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const postButton = ctx.session.isPostButtonEnabled;
    const keyboard = post.hasSound ?
      getInlineKeyboard(withSound ? 'Video' : 'Sound', postButton, post._id) :
      getInlineKeyboard('LinkOnly', postButton, post._id);
    ctx.editMessageMedia(data, { parse_mode: 'HTML', reply_markup: keyboard }).then(result => {
      if ((withSound && post.videoWithSoundId) || (withSound === false && post.videoId)) return;
      const type = withSound ? 'video' : 'document';
      const file_id = (<Message>result)[type]?.file_id;
      if (file_id) {
        const field = withSound ? 'videoWithSoundId' : 'videoId';
        post[field] = file_id;
        post.save();
      }
      resolve(true);
    }).catch(e => {
      console.log(e);
      ctx.answerCbQuery('media error, try again');
      post.videoUrl = post.videoUrl.replace(/DASH_(?:720|1080)/, 'DASH_240');
      post.save();
      resolve(false);
    });
  });
};