import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { UserService } from '../../user/user.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { SkillService } from '../../skill/skill.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
const { PDFParse } = require('pdf-parse');

export interface TalentProfileData {
  name: string;
  headline: string;
  skills: string[];
  portfolioProjects: Array<{
    title: string;
    description?: string;
  }>;
  cvText?: string;
}

export interface AnalysisResult {
  summary: string;
  keyStrengths: string[];
  areasToImprove: string[];
  recommendedTags: string[];
  profileScore: number;
}

@Injectable()
export class AiProfileAnalyzerService {
  private readonly logger = new Logger(AiProfileAnalyzerService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly userService: UserService,
    private readonly portfolioService: PortfolioService,
    private readonly skillService: SkillService,
    private readonly profileAnalysisService: ProfileAnalysisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Analyze a talent's profile using AI
   */
  async analyzeProfile(talentId: string): Promise<AnalysisResult> {
    if (!this.aiService.isAvailable()) {
      throw new ServiceUnavailableException(
        'AI service is not available. Please check configuration.',
      );
    }

    // Load talent data
    const profileData = await this.aggregateTalentData(talentId);

    // Check if we have a cached analysis
    const profileHash = this.computeProfileHash(profileData);
    const cachedAnalysis = await this.profileAnalysisService.findLatestByTalentId(talentId);

    if (
      cachedAnalysis &&
      cachedAnalysis.profileHash === profileHash &&
      this.isAnalysisRecent(cachedAnalysis.createdAt)
    ) {
      this.logger.debug(`Using cached analysis for talent ${talentId}`);
      return {
        summary: cachedAnalysis.summary,
        keyStrengths: cachedAnalysis.keyStrengths,
        areasToImprove: cachedAnalysis.areasToImprove,
        recommendedTags: cachedAnalysis.recommendedTags,
        profileScore: cachedAnalysis.profileScore,
      };
    }

    // Generate prompt
    const prompt = this.buildAnalysisPrompt(profileData);

    // Call AI service
    const provider = this.aiService.getProvider();
    const model = this.configService?.get<string>('AI_MODEL') || 'N/A';
    this.logger.log(`Analyzing profile for talent ${talentId} using ${provider} (model: ${model})`);
    const startTime = Date.now();
    
    const analysis = await this.aiService.generateJsonContent(prompt, 1);
    
    const elapsed = Date.now() - startTime;
    this.logger.log(`Profile analysis completed in ${elapsed}ms for talent ${talentId} (provider: ${provider}, model: ${model})`);

    // Validate and normalize response
    const normalizedAnalysis = this.normalizeAnalysisResponse(analysis);

    // Save to database
    await this.profileAnalysisService.saveAnalysis(talentId, normalizedAnalysis, profileHash);

    return normalizedAnalysis;
  }

  /**
   * Aggregate all talent data for analysis
   */
  private async aggregateTalentData(talentId: string): Promise<TalentProfileData> {
    // Load user/talent
    const user = await this.userService.findById(talentId);
    if (!user) {
      throw new NotFoundException('Talent not found');
    }

    // Load skills (handle gracefully if empty)
    let skillNames: string[] = [];
    if (user.skills && user.skills.length > 0) {
      try {
        const skills = await this.skillService.findByIds(user.skills);
        skillNames = skills.map((skill) => skill.name).filter((name) => name);
      } catch (error) {
        this.logger.warn(`Failed to load skills for talent ${talentId}: ${error.message}`);
        // Continue without skills
      }
    }

    // Load portfolio projects (handle gracefully if empty)
    let portfolioProjects: Array<{ title: string; description?: string }> = [];
    try {
      const projects = await this.portfolioService.findAllByTalent(talentId);
      portfolioProjects = projects
        .map((project) => ({
          title: this.sanitizeText(project.title || 'Untitled Project'),
          description: project.description ? this.sanitizeText(project.description) : undefined,
        }))
        .filter((project) => project.title.trim().length > 0);
    } catch (error) {
      this.logger.warn(`Failed to load portfolio projects for talent ${talentId}: ${error.message}`);
      // Continue without projects
    }

    // Extract CV text if available (handle gracefully if fails)
    let cvText: string | undefined;
    if (user.cvUrl) {
      try {
        const extractedText = await this.extractCvText(user.cvUrl);
        if (extractedText && extractedText.trim().length > 0) {
          cvText = this.sanitizeText(extractedText);
          // Limit CV text length to avoid token limits
          const maxCvLength = 3000;
          if (cvText.length > maxCvLength) {
            // Try to keep summary/experience/skills sections
            cvText = this.reduceCvLength(cvText, maxCvLength);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to extract CV text for talent ${talentId}: ${error.message}`);
        // Continue without CV text
      }
    }

    // Build headline
    const headline = this.buildHeadline(user);

    return {
      name: this.sanitizeText(user.fullName || 'Unknown'),
      headline: this.sanitizeText(headline),
      skills: skillNames.map((skill) => this.sanitizeText(skill)),
      portfolioProjects,
      cvText,
    };
  }

  /**
   * Build headline from user data
   */
  private buildHeadline(user: any): string {
    const parts: string[] = [];

    if (user.talent && Array.isArray(user.talent) && user.talent.length > 0) {
      parts.push(user.talent.join(', '));
    } else if (user.talent && typeof user.talent === 'string') {
      parts.push(user.talent);
    }

    if (user.description) {
      parts.push(user.description);
    }

    return parts.join(' - ') || 'No headline available';
  }

  /**
   * Extract text from CV file
   */
  private async extractCvText(cvUrl: string): Promise<string> {
    try {
      // Resolve file path
      const filePath = path.isAbsolute(cvUrl)
        ? cvUrl
        : path.join(process.cwd(), cvUrl);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        this.logger.warn(`CV file not found at path: ${filePath}`);
        return '';
      }

      // Read file
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();

      // Extract text based on file type
      if (ext === '.pdf') {
        const parser = new PDFParse({ data: fileBuffer });
        const result = await parser.getText();
        return this.sanitizeText(result.text);
      } else if (ext === '.doc' || ext === '.docx') {
        // For DOC/DOCX, we would need a library like mammoth or docx
        // For now, return empty string and log a warning
        this.logger.warn('DOC/DOCX parsing not yet implemented. Only PDF is supported.');
        return '';
      }

      return '';
    } catch (error) {
      this.logger.error(`Error extracting CV text: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Build the analysis prompt for AI
   */
  private buildAnalysisPrompt(data: TalentProfileData): string {
    const parts: string[] = [];

    parts.push('You are an expert career advisor analyzing a talent profile for a creative recruitment platform.');
    parts.push('');
    parts.push('Analyze the following talent profile and provide structured feedback in JSON format only:');
    parts.push('');
    parts.push(`Name: ${data.name}`);
    parts.push(`Headline/Main Talent: ${data.headline || 'Not specified'}`);
    parts.push('');

    if (data.skills.length > 0) {
      parts.push(`Skills: ${data.skills.join(', ')}`);
    } else {
      parts.push('Skills: None listed (this should be noted as an area to improve)');
    }
    parts.push('');

    if (data.portfolioProjects.length > 0) {
      parts.push('Portfolio Projects:');
      data.portfolioProjects.forEach((project, index) => {
        parts.push(`${index + 1}. ${project.title}`);
        if (project.description) {
          // Limit description length per project
          const maxDescLength = 500;
          const desc = project.description.length > maxDescLength
            ? project.description.substring(0, maxDescLength) + '...'
            : project.description;
          parts.push(`   Description: ${desc}`);
        }
      });
    } else {
      parts.push('Portfolio Projects: None (this is a significant area to improve)');
    }
    parts.push('');

    if (data.cvText && data.cvText.trim().length > 0) {
      parts.push('CV Content (preview):');
      parts.push(data.cvText);
      if (data.cvText.length > 3000) {
        parts.push('(Note: CV has been truncated for analysis)');
      }
    } else {
      parts.push('CV: Not uploaded (this should be noted as an area to improve)');
    }
    parts.push('');

    parts.push('Provide your analysis in the following JSON format (ONLY JSON, no other text):');
    parts.push('{');
    parts.push('  "summary": "A concise 3-4 line summary of the talent profile",');
    parts.push('  "keyStrengths": ["strength 1", "strength 2", ...],');
    parts.push('  "areasToImprove": ["improvement 1", "improvement 2", ...],');
    parts.push('  "recommendedTags": ["tag1", "tag2", ...],');
    parts.push('  "profileScore": 75');
    parts.push('}');
    parts.push('');
    parts.push('Guidelines:');
    parts.push('- summary: 3-4 sentences highlighting the talent\'s main attributes and potential');
    parts.push('- keyStrengths: 3-5 specific strengths based on their profile, skills, projects, and CV');
    parts.push('- areasToImprove: 3-5 actionable suggestions to enhance their profile (mention missing elements like skills, projects, or CV if applicable)');
    parts.push('- recommendedTags: 5-10 relevant tags/keywords for matching with opportunities (based on their skills, projects, and headline)');
    parts.push('- profileScore: A number between 0-100 indicating profile completeness and strength');
    parts.push('  * Consider: profile completeness, skill depth, portfolio quality/quantity, CV presence');
    parts.push('  * Lower scores for missing skills, projects, or CV');
    parts.push('  * Higher scores for complete profiles with detailed information');
    parts.push('');
    parts.push('Be constructive, specific, and professional in your feedback. Adapt your analysis based on what information is available.');

    return parts.join('\n');
  }

  /**
   * Normalize and validate analysis response
   */
  private normalizeAnalysisResponse(analysis: any): AnalysisResult {
    // Ensure all required fields exist
    const normalized: AnalysisResult = {
      summary:
        typeof analysis.summary === 'string' && analysis.summary.trim()
          ? analysis.summary.trim()
          : 'No summary available.',
      keyStrengths: Array.isArray(analysis.keyStrengths)
        ? analysis.keyStrengths
            .filter((s: any) => typeof s === 'string' && s.trim())
            .map((s: string) => s.trim())
            .slice(0, 10) // Limit to 10
        : [],
      areasToImprove: Array.isArray(analysis.areasToImprove)
        ? analysis.areasToImprove
            .filter((s: any) => typeof s === 'string' && s.trim())
            .map((s: string) => s.trim())
            .slice(0, 10) // Limit to 10
        : [],
      recommendedTags: Array.isArray(analysis.recommendedTags)
        ? analysis.recommendedTags
            .filter((s: any) => typeof s === 'string' && s.trim())
            .map((s: string) => s.trim())
            .slice(0, 15) // Limit to 15
        : [],
      profileScore: this.normalizeScore(analysis.profileScore),
    };

    // Ensure at least some content
    if (!normalized.summary || normalized.summary === 'No summary available.') {
      normalized.summary = 'Profile analysis completed.';
    }

    if (normalized.keyStrengths.length === 0) {
      normalized.keyStrengths = ['Profile shows potential for growth'];
    }

    if (normalized.areasToImprove.length === 0) {
      normalized.areasToImprove = ['Consider adding more details to your profile'];
    }

    return normalized;
  }

  /**
   * Normalize profile score to 0-100 range
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
   * Sanitize text (remove HTML, normalize whitespace, clean special characters)
   */
  private sanitizeText(text: string): string {
    if (!text) return '';

    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
      .replace(/&amp;/g, '&') // Replace HTML entities
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable characters (keep newlines, tabs, spaces)
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove multiple newlines
      .replace(/\n{3,}/g, '\n\n') // Limit to max 2 consecutive newlines
      .trim();
  }

  /**
   * Reduce CV text length while keeping important sections
   */
  private reduceCvLength(cvText: string, maxLength: number): string {
    if (cvText.length <= maxLength) {
      return cvText;
    }

    // Try to extract key sections (case-insensitive)
    const sections: string[] = [];
    
    // Look for common CV sections
    const sectionKeywords = [
      'summary', 'résumé', 'objective', 'objectif',
      'experience', 'expérience', 'work history', 'employment',
      'education', 'éducation', 'formation',
      'skills', 'compétences', 'competencies',
      'achievements', 'réalisations', 'accomplishments',
    ];

    const lowerText = cvText.toLowerCase();
    let lastIndex = 0;

    // Extract sections by keywords
    for (const keyword of sectionKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b[\\s\\S]{0,500}`, 'gi');
      const matches = cvText.match(regex);
      if (matches && matches.length > 0) {
        sections.push(...matches);
      }
    }

    // If we found sections, prioritize them
    if (sections.length > 0) {
      let result = sections.join('\n\n');
      if (result.length > maxLength) {
        // Truncate from sections
        result = result.substring(0, maxLength);
        // Try to end at a word boundary
        const lastSpace = result.lastIndexOf(' ');
        if (lastSpace > maxLength * 0.9) {
          result = result.substring(0, lastSpace) + '...';
        } else {
          result = result + '...';
        }
      }
      return result;
    }

    // Fallback: truncate from beginning (first part usually has summary/experience)
    let result = cvText.substring(0, maxLength);
    const lastSpace = result.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.9) {
      result = result.substring(0, lastSpace) + '...';
    } else {
      result = result + '...';
    }
    return result;
  }

  /**
   * Compute hash of profile data for change detection
   */
  private computeProfileHash(data: TalentProfileData): string {
    const hashInput = JSON.stringify({
      name: data.name,
      headline: data.headline,
      skills: data.skills.sort(),
      projects: data.portfolioProjects.map((p) => ({
        title: p.title,
        description: p.description?.substring(0, 200), // Truncate for hash
      })),
      hasCv: !!data.cvText,
    });

    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Check if analysis is recent (within 24 hours)
   */
  private isAnalysisRecent(createdAt: Date): boolean {
    const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation < 24;
  }
}

