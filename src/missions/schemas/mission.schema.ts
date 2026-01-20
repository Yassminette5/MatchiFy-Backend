import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface MissionDocument extends Mission, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class Mission extends Document {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  duration: string;

  @Prop({ required: true, type: Number })
  budget: number;

  @Prop({ type: Number, default: 0 })
  proposalsCount: number;

  @Prop({ type: Number, default: 0 })
  interviewingCount: number;

  @Prop({
    type: [String],
    required: true,
  })
  skills: string[];

  @Prop({ required: true, type: String, index: true })
  recruiterId: string;

  @Prop({
    type: String,
    enum: ['in_progress', 'started', 'completed'],
    default: 'in_progress',
    index: true,
  })
  status: string;
}

export const MissionSchema = SchemaFactory.createForClass(Mission);

const baseTransform = (_: any, ret: any) => {
  ret.id = ret._id?.toString();
  ret.missionId = ret._id?.toString();
  ret.price = ret.price ?? ret.budget ?? 0;
  ret.proposalsCount = ret.proposalsCount ?? 0;
  ret.interviewingCount = ret.interviewingCount ?? 0;
  ret.ownerId = ret.ownerId ?? ret.recruiterId ?? ret._id?.toString();
  return ret;
};

MissionSchema.set('toJSON', {
  virtuals: true,
  transform: baseTransform,
});

MissionSchema.set('toObject', {
  virtuals: true,
  transform: baseTransform,
});

