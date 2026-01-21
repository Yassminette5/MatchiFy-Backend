import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProfileAnalysis,
  ProfileAnalysisDocument,
} from '../schemas/profile-analysis.schema';
import { AnalysisResult } from './ai-profile-analyzer.service';

@Injectable()
export class ProfileAnalysisService {
  constructor(
    @InjectModel(ProfileAnalysis.name)
    private profileAnalysisModel: Model<ProfileAnalysisDocument>,
  ) {}

  /**
   * Find the latest analysis for a talent
   */
  async findLatestByTalentId(talentId: string): Promise<ProfileAnalysisDocument | null> {
    return this.profileAnalysisModel
      .findOne({ talentId })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Save a new analysis
   */
  async saveAnalysis(
    talentId: string,
    analysis: AnalysisResult,
    profileHash: string,
  ): Promise<ProfileAnalysisDocument> {
    const analysisDoc = new this.profileAnalysisModel({
      talentId,
      summary: analysis.summary,
      keyStrengths: analysis.keyStrengths,
      areasToImprove: analysis.areasToImprove,
      recommendedTags: analysis.recommendedTags,
      profileScore: analysis.profileScore,
      profileHash,
    });

    return analysisDoc.save();
  }

  /**
   * Get analysis history for a talent
   */
  async getHistory(talentId: string, limit: number = 10): Promise<ProfileAnalysisDocument[]> {
    return this.profileAnalysisModel
      .find({ talentId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}










