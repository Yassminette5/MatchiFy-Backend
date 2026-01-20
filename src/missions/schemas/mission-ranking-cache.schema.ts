import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface MissionRankingCacheDocument extends MissionRankingCache, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class MissionRankingCache {
  @Prop({ required: true, type: String, index: true })
  talentId: string;

  @Prop({ required: true, type: [Object] })
  rankings: Array<{
    missionId: string;
    matchScore: number;
    reasoning: string;
    title?: string;
    description?: string;
    duration?: string;
    budget?: number;
    skills?: string[];
    recruiterId?: string;
  }>;

  @Prop({ type: Date, default: Date.now })
  expiresAt: Date;
}

export const MissionRankingCacheSchema = SchemaFactory.createForClass(MissionRankingCache);

// Index for efficient lookups and automatic expiration
MissionRankingCacheSchema.index({ talentId: 1, expiresAt: 1 });
MissionRankingCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

