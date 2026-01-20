import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Mission, MissionDocument } from '../schemas/mission.schema';
import {
  MissionRankingCache,
  MissionRankingCacheDocument,
} from '../schemas/mission-ranking-cache.schema';
import { ProfileAnalysisService } from '../../ai/services/profile-analysis.service';
import { AiService } from '../../ai/services/ai.service';

export interface BestMatchMission {
  missionId: string;
  title: string;
  description: string;
  duration: string;
  budget: number;
  skills: string[];
  recruiterId: string;
  matchScore: number;
  reasoning: string;
}

@Injectable()
export class BestMatchService {
  private readonly logger = new Logger(BestMatchService.name);
  private readonly CACHE_DURATION_HOURS = 12;
  private readonly refreshInProgress = new Map<string, Promise<BestMatchMission[]>>();

  constructor(
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    @InjectModel(MissionRankingCache.name)
    private cacheModel: Model<MissionRankingCacheDocument>,
    private readonly profileAnalysisService: ProfileAnalysisService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Get best match missions for a talent
   * Uses cached results if available and valid
   * Returns stale cache if refresh fails
   */
  async getBestMatches(talentId: string): Promise<BestMatchMission[]> {
    // Check cache first
    const cached = await this.getCachedRankings(talentId);
    if (cached && cached.length > 0) {
      this.logger.debug(`Using cached rankings for talent ${talentId} (${cached.length} missions)`);
      
      // Trigger refresh in background (non-blocking)
      this.refreshRankings(talentId).catch((error) => {
        this.logger.error(
          `Failed to refresh rankings for talent ${talentId}: ${error.message}`,
          error.stack,
        );
      });
      
      return cached;
    }

    // If no cache, try to compute rankings synchronously (but with timeout protection)
    try {
      const rankings = await Promise.race([
        this.refreshRankings(talentId),
        new Promise<BestMatchMission[]>((_, reject) =>
          setTimeout(() => reject(new Error('Refresh timeout')), 90000), // 90s timeout (Ollama peut être lent)
        ),
      ]);
      
      if (rankings && rankings.length > 0) {
        return rankings;
      }
    } catch (error: any) {
      this.logger.warn(
        `Failed to refresh rankings synchronously for talent ${talentId}: ${error.message}`,
      );
      
      // Try to get stale cache (expired but still useful)
      const staleCache = await this.getCachedRankings(talentId, true);
      if (staleCache && staleCache.length > 0) {
        this.logger.debug(`Using stale cache for talent ${talentId}`);
        return staleCache;
      }
    }

    // Return empty array if no cache available
    return [];
  }

  /**
   * Refresh rankings for a talent (async background process)
   * Prevents multiple simultaneous refreshes for the same talent
   */
  async refreshRankings(talentId: string): Promise<BestMatchMission[]> {
    // Check if a refresh is already in progress for this talent
    const existingRefresh = this.refreshInProgress.get(talentId);
    if (existingRefresh) {
      this.logger.debug(`Refresh already in progress for talent ${talentId}, waiting...`);
      return existingRefresh;
    }
    
    // Start new refresh
    const refreshPromise = this.doRefreshRankings(talentId);
    this.refreshInProgress.set(talentId, refreshPromise);
    
    // Clean up when done
    refreshPromise.finally(() => {
      this.refreshInProgress.delete(talentId);
    });
    
    return refreshPromise;
  }
  
  /**
   * Internal method to actually perform the refresh
   */
  private async doRefreshRankings(talentId: string): Promise<BestMatchMission[]> {
    this.logger.log(`Refreshing rankings for talent ${talentId}`);

    // Load latest profile analysis
    const profileAnalysis = await this.profileAnalysisService.findLatestByTalentId(
      talentId,
    );

    if (!profileAnalysis) {
      this.logger.warn(
        `No profile analysis found for talent ${talentId}. Cannot compute best matches.`,
      );
      // Return stale cache if available
      const staleCache = await this.getCachedRankings(talentId, true);
      return staleCache || [];
    }

    // Load all missions
    const missions = await this.missionModel.find().exec();

    if (missions.length === 0) {
      this.logger.debug(`No missions found in database`);
      // Return stale cache if available
      const staleCache = await this.getCachedRankings(talentId, true);
      return staleCache || [];
    }

    // Score all missions (with error handling)
    let scoredMissions: BestMatchMission[] = [];
    try {
      scoredMissions = await this.scoreMissions(
        missions,
        profileAnalysis,
      );
    } catch (error: any) {
      this.logger.error(
        `Error scoring missions for talent ${talentId}: ${error.message}`,
      );
      // Return stale cache if available
      const staleCache = await this.getCachedRankings(talentId, true);
      if (staleCache && staleCache.length > 0) {
        this.logger.debug(`Returning stale cache after scoring error`);
        return staleCache;
      }
      return [];
    }

    // If we got no results, return stale cache
    if (scoredMissions.length === 0) {
      this.logger.warn(`No missions scored successfully for talent ${talentId}`);
      const staleCache = await this.getCachedRankings(talentId, true);
      return staleCache || [];
    }

    // Sort by matchScore descending and take top 20
    const topMatches = scoredMissions
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);

    // Cache results (only if we have results)
    if (topMatches.length > 0) {
      await this.cacheRankings(talentId, topMatches);
    }

    this.logger.log(
      `Rankings refreshed for talent ${talentId}: ${topMatches.length} matches found`,
    );

    return topMatches;
  }

  /**
   * Score all missions using Ollama
   */
  private async scoreMissions(
    missions: MissionDocument[],
    profileAnalysis: any,
  ): Promise<BestMatchMission[]> {
    const scoredMissions: BestMatchMission[] = [];

    // Build prompt components from profile analysis
    const profileSummary = profileAnalysis.summary || '';
    const keyStrengths = profileAnalysis.keyStrengths?.join(', ') || '';
    const recommendedTags = profileAnalysis.recommendedTags?.join(', ') || '';

    // Score missions in parallel (with concurrency limit to avoid overwhelming Ollama)
    // Reduced to 2 to prevent timeouts and reduce load on Ollama
    const CONCURRENCY_LIMIT = 2;
    for (let i = 0; i < missions.length; i += CONCURRENCY_LIMIT) {
      const batch = missions.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.allSettled(
        batch.map((mission) =>
          this.scoreSingleMission(mission, {
            summary: profileSummary,
            keyStrengths,
            recommendedTags,
          }),
        ),
      );

      // Extract successful results, log failures but continue
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value !== null) {
          scoredMissions.push(result.value);
        } else if (result.status === 'rejected') {
          this.logger.warn(
            `Failed to score mission in batch: ${result.reason?.message || 'Unknown error'}`,
          );
        }
      }
      
      // Add a small delay between batches to avoid overwhelming Ollama
      if (i + CONCURRENCY_LIMIT < missions.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between batches
      }
    }

    return scoredMissions;
  }

  /**
   * Normalize score to 0-100 range
   */
  private normalizeScore(score: any): number {
    if (typeof score === 'number') {
      return Math.max(0, Math.min(100, Math.round(score)));
    }

    if (typeof score === 'string') {
      const parsed = parseFloat(score);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }

    // Default score if invalid
    return 50;
  }

  /**
   * Score a single mission using Ollama
   * Uses strict bottleneck scoring formula
   */
  private async scoreSingleMission(
    mission: MissionDocument,
    profileData: {
      summary: string;
      keyStrengths: string;
      recommendedTags: string;
    },
  ): Promise<BestMatchMission | null> {
    try {
      const prompt = this.buildRankingPrompt(mission, profileData);

      const response = await this.aiService.generateJsonContent(prompt, 1);

      // Validate response structure
      if (!response || typeof response.reasoning !== 'string') {
        this.logger.warn(
          `Invalid response from AI for mission ${mission._id}: missing reasoning`,
        );
        return null;
      }

      // Extract category scores - support both new format and legacy format
      const categoryScoresObj = response.categoryScores || response.radar || {};
      
      const skillsMatch = this.normalizeScore(categoryScoresObj.skillsMatch ?? 0);
      const experienceFit = this.normalizeScore(categoryScoresObj.experienceFit ?? 0);
      const projectRelevance = this.normalizeScore(categoryScoresObj.projectRelevance ?? 0);
      const missionRequirementsFit = this.normalizeScore(
        categoryScoresObj.missionRequirementsFit ?? 
        categoryScoresObj.overallCoherence ?? 
        0
      );
      const softSkillsFit = this.normalizeScore(
        categoryScoresObj.softSkillsFit ?? 
        categoryScoresObj.talentStrengthAlignment ?? 
        0
      );

      // Calculate final score using strict bottleneck formula
      const categoryScores = [
        skillsMatch,
        experienceFit,
        projectRelevance,
        missionRequirementsFit,
        softSkillsFit,
      ];
      
      const matchScore = this.calculateBottleneckScore(categoryScores);

      return {
        missionId: String(mission._id),
        title: mission.title,
        description: mission.description,
        duration: mission.duration,
        budget: mission.budget,
        skills: mission.skills,
        recruiterId: String(mission.recruiterId),
        matchScore,
        reasoning: response.reasoning.trim().substring(0, 200), // Limit reasoning length
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to score mission ${mission._id}: ${error.message}`,
      );
      // Return null to skip this mission
      return null;
    }
  }

  /**
   * Calculate final score using strict bottleneck formula
   * Weak categories heavily reduce the final score
   */
  private calculateBottleneckScore(categoryScores: number[]): number {
    if (categoryScores.length === 0) {
      return 0;
    }

    // Find the minimum (bottleneck) score
    const minScore = Math.min(...categoryScores);
    
    // Calculate average of all categories
    const avgScore = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;

    // Strict bottleneck formula: minimum score has heavy weight
    // If minimum score is very low (< 50), it dominates even more
    let bottleneckWeight = 0.7; // Default: minimum score has 70% weight
    if (minScore < 50) {
      bottleneckWeight = 0.85; // Very weak category dominates (85% weight)
    } else if (minScore < 70) {
      bottleneckWeight = 0.75; // Weak category has 75% weight
    }

    // Final score: heavily penalized by weakest category
    const finalScore = (minScore * bottleneckWeight) + (avgScore * (1 - bottleneckWeight));

    return Math.max(0, Math.min(100, Math.round(finalScore)));
  }

  /**
   * Build ranking prompt for Ollama
   * Uses the same strict scoring model as detailed mission fit analysis
   */
  private buildRankingPrompt(
    mission: MissionDocument,
    profileData: {
      summary: string;
      keyStrengths: string;
      recommendedTags: string;
    },
  ): string {
    const parts: string[] = [];

    parts.push(
      'You are an expert recruiter matching talents with mission opportunities.',
    );
    parts.push('');
    parts.push(
      'Analyze how well this talent profile matches the following mission. Return category scores in JSON format (ONLY JSON, no other text).',
    );
    parts.push('');
    parts.push('=== TALENT PROFILE ===');
    parts.push(`Summary: ${profileData.summary}`);
    parts.push(`Key Strengths: ${profileData.keyStrengths}`);
    parts.push(`Recommended Tags: ${profileData.recommendedTags}`);
    parts.push('');
    parts.push('=== MISSION ===');
    parts.push(`Title: ${mission.title}`);
    parts.push(`Description: ${mission.description}`);
    parts.push(`Skills Required: ${mission.skills.join(', ')}`);
    parts.push(`Duration: ${mission.duration}`);
    parts.push(`Budget: ${mission.budget} €`);
    parts.push('');
    parts.push(
      'Provide your analysis in the following JSON format (ONLY JSON, no other text):',
    );
    parts.push('{');
    parts.push('  "categoryScores": {');
    parts.push('    "skillsMatch": 85,');
    parts.push('    "experienceFit": 75,');
    parts.push('    "projectRelevance": 80,');
    parts.push('    "missionRequirementsFit": 82,');
    parts.push('    "softSkillsFit": 78');
    parts.push('  },');
    parts.push('  "reasoning": "Short explanation of the match (1-2 lines)"');
    parts.push('}');
    parts.push('');
    parts.push('CRITICAL: Do NOT include a "matchScore" field. Only provide category scores.');
    parts.push('The final score will be calculated automatically using a strict bottleneck formula.');
    parts.push('');
    parts.push('Guidelines for category scores (0-100 each):');
    parts.push(
      '- categoryScores.skillsMatch: How well talent skills match mission requirements (0-100). Be strict: missing critical skills significantly lowers this score.',
    );
    parts.push(
      '- categoryScores.experienceFit: How well talent experience aligns with mission needs (0-100). Consider years of experience, similar projects, and industry relevance.',
    );
    parts.push(
      '- categoryScores.projectRelevance: Relevance of talent portfolio projects to mission context (0-100). Evaluate if past projects demonstrate capabilities needed for this mission.',
    );
    parts.push(
      '- categoryScores.missionRequirementsFit: How well talent meets ALL specific mission requirements (0-100). Be strict: missing any key requirement significantly lowers this score.',
    );
    parts.push(
      '- categoryScores.softSkillsFit: How well talent soft skills (communication, teamwork, adaptability, etc.) align with mission needs (0-100).',
    );
    parts.push(
      '- reasoning: A concise 1-2 line explanation of why this is a good or poor match',
    );
    parts.push('');
    parts.push(
      'IMPORTANT: Score each category independently and strictly. A talent must excel in ALL categories to receive high scores. Be critical and realistic in your assessment.',
    );
    parts.push(
      'Be specific and professional. Focus on concrete matches between talent strengths and mission requirements.',
    );

    return parts.join('\n');
  }

  /**
   * Get cached rankings if available and valid
   * @param allowStale If true, returns expired cache as fallback
   */
  private async getCachedRankings(
    talentId: string,
    allowStale: boolean = false,
  ): Promise<BestMatchMission[] | null> {
    const query: any = { talentId };
    if (!allowStale) {
      query.expiresAt = { $gt: new Date() };
    }
    
    const cache = await this.cacheModel
      .findOne(query)
      .sort({ createdAt: -1 })
      .exec();

    if (!cache) {
      return null;
    }

    // Convert cache to BestMatchMission format
    // We need to fetch mission details from database
    const missionIds = cache.rankings.map((r) => r.missionId);
    const missions = await this.missionModel
      .find({ _id: { $in: missionIds } })
      .exec();

    const missionMap = new Map(
      missions.map((m) => [String(m._id), m]),
    );

    return cache.rankings
      .map((ranking) => {
        // Try to get mission from database first (most up-to-date)
        const mission = missionMap.get(ranking.missionId);
        if (mission) {
          return {
            missionId: ranking.missionId,
            title: mission.title,
            description: mission.description,
            duration: mission.duration,
            budget: mission.budget,
            skills: mission.skills,
            recruiterId: String(mission.recruiterId),
            matchScore: ranking.matchScore,
            reasoning: ranking.reasoning,
          };
        }
        // Fallback to cached data if mission not found in database
        if (ranking.title && ranking.description) {
          return {
            missionId: ranking.missionId,
            title: ranking.title,
            description: ranking.description,
            duration: ranking.duration || '',
            budget: ranking.budget || 0,
            skills: ranking.skills || [],
            recruiterId: ranking.recruiterId || '',
            matchScore: ranking.matchScore,
            reasoning: ranking.reasoning,
          };
        }
        return null;
      })
      .filter((m): m is BestMatchMission => m !== null);
  }

  /**
   * Cache rankings for a talent
   */
  private async cacheRankings(
    talentId: string,
    rankings: BestMatchMission[],
  ): Promise<void> {
    // Delete old cache entries for this talent
    await this.cacheModel.deleteMany({ talentId }).exec();

    // Create new cache entry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.CACHE_DURATION_HOURS);

    const cacheData = {
      talentId,
      rankings: rankings.map((r) => ({
        missionId: r.missionId,
        matchScore: r.matchScore,
        reasoning: r.reasoning,
        // Store additional mission data for faster retrieval
        title: r.title,
        description: r.description,
        duration: r.duration,
        budget: r.budget,
        skills: r.skills,
        recruiterId: r.recruiterId,
      })),
      expiresAt,
    };

    await this.cacheModel.create(cacheData);
  }
}

