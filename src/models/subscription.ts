import mongoose, { Document } from 'mongoose';
import contentType from './contentType';
import categoryType from './categoryType';

export interface ISubscription extends Document {
  userId: number;
  subredditId: string;
  type: contentType;
  category: categoryType;
  minRating: number;
}

export const SubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      required: true,
      index: true,
    },
    subredditId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: Number,
      required: true,
    },
    category: {
      type: Number,
      required: true,
    },
    minRating: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    _id: true,
  }
);

// Exports
export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);


