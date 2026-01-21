import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface OfferDocument extends Offer, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Offer extends Document {
  @Prop({
    required: true,
    type: String,
    enum: ['Development', 'Marketing', 'Teaching Online', 'Video Editing', 'Coaching'],
    index: true,
  })
  category: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, type: [String] })
  keywords: string[];

  @Prop({ required: true, type: Number })
  price: number;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  bannerImage: string;

  @Prop({ type: [String], default: [] })
  galleryImages: string[];

  @Prop({ type: String })
  introductionVideo?: string;

  @Prop({ type: [String], default: [] })
  capabilities: string[];

  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ type: Date, default: Date.now })
  dateOfPosting: Date;

  @Prop({
    type: [
      {
        recruiterId: { type: String, required: true },
        recruiterName: { type: String, required: true },
        rating: { type: Number, required: true },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reviews: {
    recruiterId: string;
    recruiterName: string;
    rating: number;
    message: string;
    createdAt: Date;
  }[];
}

export const OfferSchema = SchemaFactory.createForClass(Offer);

const baseTransform = (_: any, ret: any) => {
  ret.id = ret._id?.toString();
  ret.offerId = ret._id?.toString();
  return ret;
};

OfferSchema.set('toJSON', {
  virtuals: true,
  transform: baseTransform,
});

OfferSchema.set('toObject', {
  virtuals: true,
  transform: baseTransform,
});
