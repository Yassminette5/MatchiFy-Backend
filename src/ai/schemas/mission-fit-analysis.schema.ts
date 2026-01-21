import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface MissionFitAnalysisDocument extends MissionFitAnalysis, Document {
  createdAt: Date;
  updatedAt: Date;
}

@Schema({ timestamps: true })
export class MissionFitAnalysis extends Document {
  @Prop({ required: true, index: true })
  talentId: string;

  @Prop({ required: true, index: true })
  missionId: string;

  @Prop({ required: true, type: Number, min: 0, max: 100 })
  score: number;

  @Prop({
    type: {
      skillsMatch: { type: Number, min: 0, max: 100 },
      experienceFit: { type: Number, min: 0, max: 100 },
      projectRelevance: { type: Number, min: 0, max: 100 },
      missionRequirementsFit: { type: Number, min: 0, max: 100 },
      softSkillsFit: { type: Number, min: 0, max: 100 },
      // Legacy fields for backward compatibility
      talentStrengthAlignment: { type: Number, min: 0, max: 100, required: false },
      overallCoherence: { type: Number, min: 0, max: 100, required: false },
    },
    required: true,
  })
  radar: {
    skillsMatch: number;
    experienceFit: number;
    projectRelevance: number;
    missionRequirementsFit: number;
    softSkillsFit: number;
    // Legacy fields for backward compatibility
    talentStrengthAlignment?: number;
    overallCoherence?: number;
  };

  @Prop({ required: true, type: String })
  shortSummary: string;

  @Prop({ required: true })
  talentHash: string; // Hash of talent profile data at time of analysis

  @Prop({ required: true })
  missionHash: string; // Hash of mission data at time of analysis

  @Prop({ type: Date, default: Date.now })
  talentUpdatedAt: Date; // Last update time of talent profile

  @Prop({ type: Date, default: Date.now })
  missionUpdatedAt: Date; // Last update time of mission
}

export const MissionFitAnalysisSchema = SchemaFactory.createForClass(MissionFitAnalysis);

// Compound index for efficient lookups
MissionFitAnalysisSchema.index({ talentId: 1, missionId: 1 }, { unique: true });

