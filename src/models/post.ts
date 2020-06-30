import mongoose, { Document } from 'mongoose';
import contentType from './contentType';
import categoryType from './categoryType';

export interface IPost extends Document {
  _id: string;
  subredditId: string;
  crossPostId: string;
  author: string;
  score: number;
  original: boolean;
  type: contentType;
  category: categoryType;
  caption: string;
  num_comments: number;
  parentCaption: string;
  text: string;
  previewImageUrl: string;
  previewImageId: string;
  videoUrl: string;
  videoId: string;
  videoWithSoundId: string;
  isRemoteVideo: boolean;
  hasSound: boolean;
  over_18: boolean;
  videoFileSize: number;
  videoDuration: number;
}

export const PostSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    subredditId: {
      type: String,
      required: true,
    },
    crossPostId: {
      type: String,
      required: false,
    },
    author: {
      type: String,
      required: true,
    },
    score: {
      type: Number,
    },
    original: {
      type: Boolean,
    },
    caption: {
      type: String,
    },
    num_comments: {
      type: Number,
    },
    parentCaption: {
      type: String,
      default: ''
    },
    text: {
      type: String,
    },
    type: {
      type: Number,
    },
    category: {
      type: Number,
    },
    previewImageUrl: {
      type: String
    },
    previewImageId: {
      type: String,
    },
    videoUrl: {
      type: String,
    },
    videoId: {
      type: String,
    },
    videoWithSoundId: {
      type: String,
    },
    hasSound: {
      type: Boolean,
      default: false,
    },
    isRemoteVideo: {
      type: Boolean,
      default: false,
    },
    over_18: {
      type: Boolean,
    },
    videoFileSize: {
      type: Number,
      default: 0,
    },
    videoDuration: {
      type: Number,
      default: 0,
    }
  },
  {
    timestamps: true,
    _id: false
  }
);

// Exports
export const Post = mongoose.model<IPost>('Post', PostSchema);


