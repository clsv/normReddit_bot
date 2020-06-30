import mongoose, { Document } from 'mongoose';

export interface IPostToUser extends Document {
  userId: number;
  postId: string;
  subredditId: string;
}

export const PostToUserSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      index: true,
    },
    postId: {
      type: String,
      required: true,
      index: true,
    },
    subredditId: {
      type: String,
      required: true,
      index: true,
    }
  },
  {
    timestamps: true,
    collection: 'postToUser',
    _id: true
  }
);

// Exports
export const PostToUser = mongoose.model<IPostToUser>('PostToUser', PostToUserSchema);

