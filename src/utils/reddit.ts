import Snoowrap, {
  Subreddit as SWSubreddit,
  Submission as SWSubmission,
  Listing as SWListing,
  ExtSubmission,
  IPreview,
  ExMedia as Media,
} from 'snoowrap';
import { Subreddit, Post, ISubreddit } from '../models';
import categoryType from '../models/categoryType';
import contentType from '../models/contentType';
import { getEnumLength } from '../utils/enums';
import request from 'request';
import to from 'await-to-js';
import fs from 'fs';
import { getRemoteFileParams } from './donwload';

const reddit = new Snoowrap({
  userAgent:
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.120 YaBrowser/19.10.3.281 Yowser/2.5 Safari/537.36',
  clientId: process.env.REDDIT_CLIENT,
  clientSecret: process.env.REDDIT_SECRET,
  username: process.env.REDDIT_USER,
  password: process.env.REDDIT_PASS,
});

export async function getSubredditInfo(name: string): Promise<ISubreddit> {
  const sWSubreddit = reddit.getSubreddit(name);
  const [err, result] = await to<SWSubreddit>(sWSubreddit.fetch());
  if (err) {
    console.log(`Subreddit ${name}, error: ${err}`);
    return undefined;
  }

  const subreddit = new Subreddit({
    _id: result.id,
    name: result.display_name,
    title: result.title,
    url: result.url,
    description: result.public_description.replace('\n', ''),
    icon: result.community_icon || result.icon_img,
    subscribers: result.subscribers,
  });

  try {
    await subreddit.save();
  } catch (e) {
    console.log(e);
  }
  return <ISubreddit>subreddit;
}

export async function getSubreddit(name: string, type: categoryType): Promise<SWListing<ExtSubmission>> {
  const subreddit = reddit.getSubreddit(name);
  let fn: Promise<SWListing<SWSubmission>>;
  switch (type) {
    case categoryType.Hot:
      fn = subreddit.getHot();
      break;
    case categoryType.Top:
      fn = subreddit.getTop({time: 'day'});
      break;
    case categoryType.New:
      fn = subreddit.getNew();
      break;
  }
  const [err, result] = await to(fn);
  if (err) {
    throw new Error(`Fetch subreddit ${name}, error`);
  }
  return <SWListing<ExtSubmission>>result;
}

export async function findSubreddit(name: string) {
  const subredditDB = await Subreddit.findOne({ name: { $regex: name, $options: 'i' } });
  if (subredditDB !== null) return subredditDB;
  try {
    return await getSubredditInfo(name);
  } catch (e) {
    console.log(e);
    return undefined;
  }
}

function convertYouTubeDuration(duration: string) {
  const time_extractor = /([0-9]*H)?([0-9]*M)?([0-9]*S)?$/;
  const extracted = time_extractor.exec(duration);
  const hours = parseInt(extracted[1], 10) || 0;
  const minutes = parseInt(extracted[2], 10) || 0;
  const seconds = parseInt(extracted[3], 10) || 0;
  return hours * 3600 + minutes * 60 + seconds;
}

function getYouTubeVideoDuration(videoId: string): Promise<number> {
  const key = process.env.YOUTUBE_API_KEY;
  return new Promise(resolve => {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${key}`;
    console.log('youtube: #', videoId);
    request.get(url, (err, resp, body) => {
      if (err) resolve(0);
      if (resp.statusCode === 200) {
        const answer = JSON.parse(body);
        if (answer?.items?.length > 0 && answer.items[0].contentDetails.duration) {
          const duration = convertYouTubeDuration(answer.items[0].contentDetails.duration);
          resolve(duration);
        }
      }
      resolve(0);
    });
  });
}

async function getVideoUrl(media: Media | null, preview: IPreview | null): Promise<[boolean, string, number]> {
  if (media === null && preview === null) return undefined;
  let videoUrl: string;
  let duration: number = 0;
  let isRemoteVideo: boolean = false;
  const matches = media?.type?.match(/(twitter|youtube|vimeo|imgur)/);
  if (matches && matches.length > 1) {
    isRemoteVideo = true;
    switch (matches[1]) {
      case 'twitter':
        videoUrl = media.oembed?.url;
        break;
      case 'youtube':
        const ytId = media.oembed.thumbnail_url.match(/\/vi\/([\w-]+)\//);
        if (ytId.length > 0) {
          videoUrl = `https://www.youtube.com/watch?v=${ytId[1]}`;
          duration = await getYouTubeVideoDuration(ytId[1]);
        }
        break;
      case 'vimeo':
        const vmId = media.oembed.html.match(/\%2F(\d+)\%3F/);
        videoUrl = vmId.length > 0 ? `https://vimeo.com/${vmId[1]}` : undefined;
        break;
      case 'imgur':
        if (media.oembed.type === 'rich') {
          videoUrl = media.oembed.url;
        }
        break;
    }
  } else {
    videoUrl = media?.reddit_video?.fallback_url
      || preview?.reddit_video_preview?.fallback_url
      || preview?.images[0].variants?.mp4?.source.url;

    const regexp = /DASH_(?:720|1080)/;
    if (videoUrl && videoUrl.search(regexp) !== -1) {
      // Сразу подрезаем качество, куда нам 720p
      videoUrl = videoUrl.replace(regexp, 'DASH_480');
    }
  }
  return [isRemoteVideo, videoUrl, duration];
}

async function hasSimilarPosts(field: string, value: string) {
  // Примитивный поиск одинаковых постов
  const similarPosts = await Post.find({ [field]: value });
  return similarPosts.length > 0;
}

function updateSubredditPosts(subreddit: ISubreddit, category: categoryType) {
  getSubreddit(subreddit.name, category).then(async posts => {
    fs.writeFileSync(`./tmp/${subreddit.name}_${categoryType[category]}.json`, JSON.stringify(posts, undefined, 2));
    for (const post of posts) {
      if (post.stickied === true) continue;
      const { id, url, author, title, score, num_comments, is_original_content: original, preview, media, selftext, over_18 } = post;
      const crossPostId = post.crosspost_parent_list ? post.crosspost_parent_list[0].id : '';
      const foundPost = await Post.findOne(crossPostId ? { crossPostId } : { _id: id });

      if (foundPost) {
        foundPost.category = foundPost.category !== category ? category : foundPost.category;
        foundPost.score = score;
        foundPost.num_comments = num_comments;
        foundPost.save();
        continue;
      }

      const newPost = new Post({
        _id: id,
        subredditId: subreddit._id,
        crossPostId,
        author: author.name,
        url,
        caption: title,
        num_comments,
        text: selftext,
        score,
        original,
        type: contentType.Text,
        category,
        over_18,
      });
      if (await hasSimilarPosts('caption', title)) continue;

      if (preview) {
        newPost.type = contentType.Image;
        newPost.previewImageUrl = preview.images[0].source.url;
        if (await hasSimilarPosts('previewImageUrl', newPost.previewImageUrl)) continue;

        let videoUrl: string;
        let videoDuration: number;
        let isRemoteVideo: boolean;
        if (post.crosspost_parent_list) {
          const parent = post.crosspost_parent_list[0];
          [isRemoteVideo, videoUrl, videoDuration] = await getVideoUrl(parent.media, parent?.preview);
          newPost.caption = `${newPost.caption}`;
          newPost.parentCaption = parent.title;
        } else {
          [isRemoteVideo, videoUrl, videoDuration] = await getVideoUrl(media, preview);
        }
        if (videoUrl) {
          newPost.type = contentType.Video;
          newPost.isRemoteVideo = isRemoteVideo;
          newPost.videoUrl = videoUrl;
          if (videoDuration !== 0) {
            newPost.videoDuration = videoDuration;
          }
          if (isRemoteVideo === false) {
            const audioParams = await getRemoteFileParams(videoUrl.replace(/DASH_.*/, 'audio'), 'file');
            const videoParams = await getRemoteFileParams(videoUrl, 'file');
            if (audioParams.fileSize !== -1) {
              newPost.hasSound = true;
            }
            newPost.videoFileSize = videoParams.fileSize;
          }
        }
      }
      try {
        newPost.save();
      } catch (e) {
        console.log(e);
      }
    }
  });
}

export function updateAllPosts() {
  console.log('running Update all posts');
  Subreddit.find((err, res) => {
    for (const subreddit of res) {
      if (subreddit.subscriberCount === 0) continue;
      const categoryTypeLength = getEnumLength(categoryType);
      for (let i = 0; i < categoryTypeLength; i += 1) {
        setTimeout(updateSubredditPosts, i * 3000, subreddit, i);
      }
    }
  });
}

async function updateSubreddit(subreddit: ISubreddit) {
  const sWSubreddit = reddit.getSubreddit(subreddit.name);
  const [err, result] = await to<SWSubreddit>(sWSubreddit.fetch());
  if (err) {
    console.log(`Update subreddit ${subreddit.name}, error: ${err}`);
    return false;
  }
  if (subreddit.icon !== result.icon_img) {
    subreddit.iconId = '';
    subreddit.icon = result.community_icon;
  }
  subreddit.subscribers = result.subscribers;
  await subreddit.save();
  return true;
}

export function updateSubreddits() {
  Subreddit.find((err, res) => {
    for (let i = 0; i < res.length; i += 1) {
      setTimeout(updateSubreddit, i * 3000, res[i]);
    }
  });
}
