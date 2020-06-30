import mongoose, { Document } from 'mongoose';
import contentType from './contentType';

export interface IUser extends Document {
  _id: number;
  firstName: string;
  lastName: string;
  username: string;
  language: 'en' | 'ru';
  messageCount: number;
  isBotBanned: boolean;
  updateTime: number;
  autosendInterval: boolean;
  contentType: contentType;
  postCount: number;
  subscriptionCount: number;
  isNSFWEnabled: boolean;
  isRemoteVideoEnabled: boolean;
  isVideoWithSoundEnabled: boolean;
  isPostButtonEnabled: boolean;
  has18: boolean;
}

const UserSchema = new mongoose.Schema(
  {
    _id: {
      type: Number,
      required: true,
    },
    firstName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      required: false,
    },
    username: {
      type: String,
      required: false,
    },
    language: {
      type: String,
      default: 'en',
      required: false,
    },
    messageCount: {
      type: Number,
      required: true,
      default: 0,
    },
    isBotBanned: {
      type: Boolean,
      required: true,
      default: false,
    },
    autosendInterval: {
      type: Number,
      required: true,
      default: 10,
    },
    isAutosendEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    contentType: {
      type: Number,
      required: true,
      default: 0,
    },
    postCount: {
      type: Number,
      default: 0,
    },
    subscriptionCount: {
      type: Number,
      default: 0
    },
    isNSFWEnabled: {
      type: Boolean,
      default: false
    },
    isRemoteVideoEnabled: {
      type: Boolean,
      default: true
    },
    isVideoWithSoundEnabled: {
      type: Boolean,
      default: true
    },
    isPostButtonEnabled: {
      type: Boolean,
      default: true
    },
    has18: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
  }
);

// Exports
export const User = mongoose.model<IUser>('User', UserSchema);
