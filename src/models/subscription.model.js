import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema(
  {
    subscribers: {
      type: Schema.Types.ObjectId, //one who subscribing
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId, //one who have channel to subscribe
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
