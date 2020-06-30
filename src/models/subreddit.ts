import mongoose, { Document } from 'mongoose';

export interface ISubreddit extends Document {
  _id: string;
  name: string;
  title: string;
  description: string;
  url: string;
  icon: string;
  iconId: string;
  subscriberCount?: number;
  subscribers: number;
}

export const SubredditSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: false,
      index: true,
    },
    title: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    url: {
      type: String,
      required: false,
    },
    icon: {
      type: String,
      required: false,
    },
    iconId: {
      type: String,
      required: false,
    },
    subscriberCount: {
      type: Number,
      required: false,
      index: true,
      default: 0,
    },
    subscribers: {
      type: Number,
      required: false,
    }
  },
  {
    timestamps: true,
  }
);

// Exports
export const Subreddit = mongoose.model<ISubreddit>('Subreddit', SubredditSchema);

