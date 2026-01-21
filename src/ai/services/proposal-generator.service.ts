import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { UserService } from '../../user/user.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { SkillService } from '../../skill/skill.service';
import { ProfileAnalysisService } from './profile-analysis.service';
import { MissionsService } from '../../missions/missions.service';
import * as fs from 'fs/promises';
import * as path from 'path';
const { PDFParse } = require('pdf-parse');

@Injectable()
export class ProposalGeneratorService {
  private readonly logger = new Logger(ProposalGeneratorService.name);
  private readonly MIN_PROPOSAL_LENGTH = 200;

  constructor(
    private readonly aiService: AiService,
    private readonly userService: UserService,
    private readonly portfolioService: PortfolioService,
    private readonly skillService: SkillService,
    private readonly profileAnalysisService: ProfileAnalysisService,
    private readonly missionsService: MissionsService,
  ) {}

  /**
   * Generate a professional proposal for a mission using AI
   */
  async generateProposalForMission(
    talentId: string,
    missionId: string,
  ): Promise<string> {
    try {
      // Load mission details
      const mission = await this.missionsService.findOne(missionId);
      if (!mission) {
        throw new NotFoundException(`Mission ${missionId} not found`);
      }

      // Load talent profile data
      const talent = await this.userService.findById(talentId);
      if (!talent || talent.role !== 'talent') {
        throw new NotFoundException(`Talent ${talentId} not found`);
      }

      // Get talent skills
      const skillNames: string[] = [];
      if (talent.skills && talent.skills.length > 0) {
        const skills = await this.skillService.findByIds(talent.skills);
        skillNames.push(...skills.map((s) => s.name));
      }

      // Get portfolio projects
      const portfolioProjects = await this.portfolioService.findAllByTalent(
        talentId,
      );
      const projectSummaries = portfolioProjects
        .slice(0, 5) // Limit to top 5 projects
        .map((p) => ({
          title: p.title,
          description: p.description || '',
          role: p.role || '',
        }));

      // Get profile analysis if available
      const profileAnalysis =
        await this.profileAnalysisService.findLatestByTalentId(talentId);

      // Get CV text if available
      let cvText = '';
      if (talent.cvUrl) {
        try {
          cvText = await this.extractCvText(talent.cvUrl);
        } catch (error) {
          this.logger.warn(
            `Failed to extract CV text for talent ${talentId}: ${error.message}`,
          );
        }
      }

      // Build prompt
      const prompt = this.buildProposalPrompt(
        mission,
        {
          name: talent.fullName,
          headline: talent.description || '',
          skills: skillNames,
          projects: projectSummaries,
          profileAnalysis: profileAnalysis
            ? {
                summary: profileAnalysis.summary,
                keyStrengths: profileAnalysis.keyStrengths,
              }
            : null,
          cvText,
        },
      );

      // Generate proposal using AI
      const response = await this.aiService.generateContent(prompt, {
        temperature: 0.7,
        maxTokens: 2000,
      });

      let proposalText = response.text.trim();

      // Validate that all mandatory sections are present
      const validationResult = this.validateProposalStructure(proposalText);
      if (!validationResult.isValid) {
        this.logger.warn(
          `Missing or invalid sections. Regenerating... Missing: ${validationResult.missingSections.join(', ')}`,
        );
        
        // Retry once with emphasis on missing sections
        const retryPrompt = this.buildProposalPrompt(mission, {
          name: talent.fullName,
          headline: talent.description || '',
          skills: skillNames,
          projects: projectSummaries,
          profileAnalysis: profileAnalysis
            ? {
                summary: profileAnalysis.summary,
                keyStrengths: profileAnalysis.keyStrengths,
              }
            : null,
          cvText,
        }) + `\n\nWARNING: The previous attempt was missing these sections: ${validationResult.missingSections.join(', ')}. You MUST include ALL 10 sections with the EXACT headers specified.`;
        
        const retryResponse = await this.aiService.generateContent(retryPrompt, {
          temperature: 0.7,
          maxTokens: 2000,
        });
        
        proposalText = retryResponse.text.trim();
        
        // Validate again
        const retryValidation = this.validateProposalStructure(proposalText);
        if (!retryValidation.isValid) {
          this.logger.error(
            `Proposal still missing sections after retry: ${retryValidation.missingSections.join(', ')}`,
          );
          throw new ServiceUnavailableException(
            'AI generation failed: required sections missing. Please try again or write your proposal manually.',
          );
        }
      }

      // Ensure minimum length
      if (proposalText.length < this.MIN_PROPOSAL_LENGTH) {
        this.logger.warn(
          `Generated proposal is too short (${proposalText.length} chars), attempting to extend...`,
        );
        // Try to extend if too short
        const extensionPrompt = `Extend the following proposal to be at least ${this.MIN_PROPOSAL_LENGTH} characters while maintaining professionalism and all sections:\n\n${proposalText}`;
        const extendedResponse = await this.aiService.generateContent(
          extensionPrompt,
          { temperature: 0.7, maxTokens: 1000 },
        );
        proposalText = extendedResponse.text.trim();
      }

      // Clean up the text (remove markdown, but preserve section structure)
      proposalText = this.cleanProposalText(proposalText);

      return proposalText;
    } catch (error) {
      this.logger.error(
        `Failed to generate proposal for talent ${talentId} and mission ${missionId}: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'AI generation is temporarily unavailable. Please try again later or write your proposal manually.',
      );
    }
  }

  /**
   * Generate a professional proposal for a mission using AI with streaming support
   * @param talentId The ID of the talent
   * @param missionId The ID of the mission
   * @param onChunk Callback function invoked for each chunk of streamed text
   * @returns The final complete proposal text
   */
  async generateProposalForMissionStream(
    talentId: string,
    missionId: string,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    try {
      // Load mission details
      const mission = await this.missionsService.findOne(missionId);
      if (!mission) {
        throw new NotFoundException(`Mission ${missionId} not found`);
      }

      // Load talent profile data
      const talent = await this.userService.findById(talentId);
      if (!talent || talent.role !== 'talent') {
        throw new NotFoundException(`Talent ${talentId} not found`);
      }

      // Get talent skills
      const skillNames: string[] = [];
      if (talent.skills && talent.skills.length > 0) {
        const skills = await this.skillService.findByIds(talent.skills);
        skillNames.push(...skills.map((s) => s.name));
      }

      // Get portfolio projects
      const portfolioProjects = await this.portfolioService.findAllByTalent(
        talentId,
      );
      const projectSummaries = portfolioProjects
        .slice(0, 5) // Limit to top 5 projects
        .map((p) => ({
          title: p.title,
          description: p.description || '',
          role: p.role || '',
        }));

      // Get profile analysis if available
      const profileAnalysis =
        await this.profileAnalysisService.findLatestByTalentId(talentId);

      // Get CV text if available
      let cvText = '';
      if (talent.cvUrl) {
        try {
          cvText = await this.extractCvText(talent.cvUrl);
        } catch (error) {
          this.logger.warn(
            `Failed to extract CV text for talent ${talentId}: ${error.message}`,
          );
        }
      }

      // Build prompt
      const prompt = this.buildProposalPrompt(
        mission,
        {
          name: talent.fullName,
          headline: talent.description || '',
          skills: skillNames,
          projects: projectSummaries,
          profileAnalysis: profileAnalysis
            ? {
                summary: profileAnalysis.summary,
                keyStrengths: profileAnalysis.keyStrengths,
              }
            : null,
          cvText,
        },
      );

      // Generate proposal using AI with streaming
      let proposalText = '';
      
      await this.aiService.generateContentStream(
        prompt,
        (chunk: string) => {
          proposalText += chunk;
          onChunk(chunk);
        },
        {
          temperature: 0.7,
          maxTokens: 2000,
        },
      );

      proposalText = proposalText.trim();

      // Validate that all mandatory sections are present
      const validationResult = this.validateProposalStructure(proposalText);
      if (!validationResult.isValid) {
        this.logger.warn(
          `Missing or invalid sections. Missing: ${validationResult.missingSections.join(', ')}`,
        );
        
        // For streaming, we cannot retry as we've already sent chunks
        // Log the error but return what we have
        this.logger.error(
          `Proposal missing sections after streaming: ${validationResult.missingSections.join(', ')}`,
        );
        
        // Still return the proposal, but it may be incomplete
        // The client can decide whether to use it or regenerate
      }

      // Ensure minimum length
      if (proposalText.length < this.MIN_PROPOSAL_LENGTH) {
        this.logger.warn(
          `Generated proposal is too short (${proposalText.length} chars)`,
        );
        // Cannot extend in streaming mode, return what we have
      }

      // Clean up the text (remove markdown, but preserve section structure)
      proposalText = this.cleanProposalText(proposalText);

      return proposalText;
    } catch (error) {
      this.logger.error(
        `Failed to generate streaming proposal for talent ${talentId} and mission ${missionId}: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'AI generation is temporarily unavailable. Please try again later or write your proposal manually.',
      );
    }
  }

  /**
   * Build the prompt for proposal generation
   */
  private buildProposalPrompt(mission: any, talentData: any): string {
    const missionInfo = `
Mission Title: ${mission.title}
Mission Description: ${mission.description}
Required Skills: ${mission.skills?.join(', ') || 'Not specified'}
Duration: ${mission.duration || 'Not specified'}
Budget: ${mission.budget ? `${mission.budget}€` : 'Not specified'}
`;

    const talentInfo = `
Available Skills: ${talentData.skills?.join(', ') || 'None specified'}
`;

    let projectsInfo = '';
    if (talentData.projects && talentData.projects.length > 0) {
      projectsInfo = '\nRelevant Experience:\n';
      talentData.projects.forEach((p: any) => {
        projectsInfo += `- ${p.title}${p.role ? ` (${p.role})` : ''}${p.description ? `: ${p.description}` : ''}\n`;
      });
    }

    let analysisInfo = '';
    if (talentData.profileAnalysis) {
      analysisInfo = `
Technical Capabilities: ${talentData.profileAnalysis.keyStrengths?.join(', ') || 'Not available'}
`;
    }

    let cvInfo = '';
    if (talentData.cvText) {
      // Limit CV text to first 1000 characters to avoid token limits
      const cvPreview = talentData.cvText.substring(0, 1000);
      cvInfo = `\nAdditional Context: ${cvPreview}${talentData.cvText.length > 1000 ? '...' : ''}`;
    }

    return `You are generating a professional, structured, client-facing proposal document for a business mission.

MISSION DETAILS:
${missionInfo}

AVAILABLE RESOURCES:
${talentInfo}${projectsInfo}${analysisInfo}${cvInfo}

═══════════════════════════════════════════════════════════════
CRITICAL INSTRUCTION - READ CAREFULLY
═══════════════════════════════════════════════════════════════

You must output EXACTLY 10 numbered sections. No section can be empty. No section can be skipped. No section can be merged. No alternative formatting is allowed. If you cannot generate all 10 sections, DO NOT answer.

Your output must contain exactly these headers in this exact order:

1. Project Overview
2. Objectives & Expected Outcomes
3. Project Scope
4. Work Method & Approach
5. Timeline / Milestones
6. Technology Stack
7. Client Responsibilities
8. Budget & Payment Structure
9. Acceptance Criteria
10. Support & Maintenance Plan

Do not write anything before section 1 or after section 10. No signature. No personal introduction. No disclaimers.

═══════════════════════════════════════════════════════════════
MANDATORY CONTENT RULES
═══════════════════════════════════════════════════════════════

FORBIDDEN:
- NO personal pronouns: Never use "I", "me", "my", "mine", "myself"
- NO personal storytelling or biography
- NO talking about the talent as a person
- NO personal introduction or signature
- NO compliments to the client ("I am excited", "I believe")
- NO mention of being a mobile developer unless the mission requires it
- NO markdown formatting, NO emojis, NO special symbols

REQUIRED:
- Use CORPORATE, PROFESSIONAL, NEUTRAL, CLIENT-ORIENTED tone
- Write in PLAIN TEXT only
- Use numbered sections (1., 2., 3., etc.) with exact headers listed above
- Use bullet lists with simple dashes (-) inside sections 3, 6, and 7
- Payment structure in section 8 must reference the mission budget: ${mission.budget ? `${mission.budget}€` : 'the specified budget'}
- Timeline in section 5 must reflect the mission duration: ${mission.duration || 'the specified timeframe'}
- Maximum 1200 words total - keep content concise and professional
- Respect all mission details: title, description, duration, budget, required skills

═══════════════════════════════════════════════════════════════
SECTION REQUIREMENTS
═══════════════════════════════════════════════════════════════

1. Project Overview
   - Summarize the mission professionally based on the mission description
   - No personal introduction, only project context

2. Objectives & Expected Outcomes
   - Describe the goals and expected results based on the mission description
   - Focus on measurable outcomes

3. Project Scope
   - List deliverables using dashes (-)
   - Align with mission description, skills, duration, and budget
   - Be specific about what will be delivered

4. Work Method & Approach
   - Provide a step-by-step professional workflow or methodology
   - No personal background, only the work process
   - Describe phases or stages

5. Timeline / Milestones
   - Break the mission duration into logical phases
   - Use format: Phase 1, Phase 2, Phase 3, etc.
   - Align with the mission duration

6. Technology Stack
   - List tools, frameworks, and languages as bullet points with dashes (-)
   - Base this on the mission's required skills
   - Be specific and relevant

7. Client Responsibilities
   - List what the client must provide using dashes (-)
   - Include: access, documents, credentials, feedback, approvals, etc.

8. Budget & Payment Structure
   - Propose a milestone-based payment plan
   - Reference the mission budget explicitly
   - Suggest payment percentages or amounts per milestone

9. Acceptance Criteria
   - Define professional, measurable criteria
   - Include quality standards, performance expectations, delivery requirements

10. Support & Maintenance Plan
    - Define after-delivery assistance
    - Specify duration and scope of support

═══════════════════════════════════════════════════════════════
LANGUAGE
═══════════════════════════════════════════════════════════════

Write in French if the mission description is in French, otherwise write in English.

═══════════════════════════════════════════════════════════════
FORMATTING EXAMPLE
═══════════════════════════════════════════════════════════════

1. Project Overview
This project aims to...

2. Objectives & Expected Outcomes
The primary objectives include...

3. Project Scope
The following deliverables will be provided:
- Deliverable 1
- Deliverable 2

[Continue with all 10 sections...]

═══════════════════════════════════════════════════════════════
If you understand these instructions, generate the complete structured proposal now with ALL 10 sections using the EXACT headers specified above. Do not deviate from this structure.
═══════════════════════════════════════════════════════════════`;
  }

  /**
   * Clean proposal text to remove markdown and formatting while preserving section structure
   */
  private cleanProposalText(text: string): string {
    // Remove markdown code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    // Remove markdown headers (but keep numbered sections)
    text = text.replace(/^#{1,6}\s+(?!\d+\.)/gm, '');
    // Remove markdown bold/italic
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    // Remove markdown links
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    // Replace bullet points with simple dashes (preserve list structure)
    text = text.replace(/^[\s]*[•*]\s+/gm, '- ');
    // Remove extra whitespace but preserve paragraph breaks
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }

  /**
   * Validate that the proposal contains all mandatory sections with exact headers
   */
  private validateProposalStructure(proposalText: string): {
    isValid: boolean;
    missingSections: string[];
  } {
    // Exact section headers as specified in the prompt
    const mandatorySections = [
      { number: '1.', header: 'Project Overview' },
      { number: '2.', header: 'Objectives & Expected Outcomes' },
      { number: '3.', header: 'Project Scope' },
      { number: '4.', header: 'Work Method & Approach' },
      { number: '5.', header: 'Timeline / Milestones' },
      { number: '6.', header: 'Technology Stack' },
      { number: '7.', header: 'Client Responsibilities' },
      { number: '8.', header: 'Budget & Payment Structure' },
      { number: '9.', header: 'Acceptance Criteria' },
      { number: '10.', header: 'Support & Maintenance Plan' },
    ];

    const missingSections: string[] = [];
    const lines = proposalText.split('\n');

    mandatorySections.forEach((section) => {
      // Check if the exact section header exists
      // Allow for some flexibility in spacing and case
      const headerPattern = new RegExp(
        `^\\s*${section.number}\\s+${section.header.replace(/[&/]/g, '\\$&')}\\s*$`,
        'mi'
      );
      
      // Also check for variations without exact spacing
      const flexiblePattern = new RegExp(
        `^\\s*${section.number}\\s+${section.header.replace(/[&/]/g, '\\$&')}`,
        'mi'
      );

      const hasExactHeader = headerPattern.test(proposalText);
      const hasFlexibleHeader = flexiblePattern.test(proposalText);

      if (!hasExactHeader && !hasFlexibleHeader) {
        missingSections.push(`${section.number} ${section.header}`);
      } else {
        // Check if section is not empty (has content after the header)
        const sectionIndex = lines.findIndex(line => 
          flexiblePattern.test(line)
        );
        
        if (sectionIndex >= 0) {
          // Look for content in the next few lines
          let hasContent = false;
          for (let i = sectionIndex + 1; i < Math.min(sectionIndex + 10, lines.length); i++) {
            const line = lines[i].trim();
            // Check if we hit the next section
            if (/^\d+\.\s+/.test(line)) {
              break;
            }
            // Check if there's actual content (not just empty lines)
            if (line.length > 0) {
              hasContent = true;
              break;
            }
          }
          
          if (!hasContent) {
            this.logger.warn(`Section ${section.number} ${section.header} appears to be empty`);
          }
        }
      }
    });

    // Check for correct order
    const foundSections: number[] = [];
    mandatorySections.forEach((section, index) => {
      const pattern = new RegExp(
        `^\\s*${section.number}\\s+${section.header.replace(/[&/]/g, '\\$&')}`,
        'mi'
      );
      const match = proposalText.match(pattern);
      if (match) {
        const position = proposalText.indexOf(match[0]);
        foundSections.push(position);
      }
    });

    // Verify sections appear in order
    for (let i = 1; i < foundSections.length; i++) {
      if (foundSections[i] <= foundSections[i - 1]) {
        this.logger.warn('Sections are not in correct order');
        break;
      }
    }

    return {
      isValid: missingSections.length === 0,
      missingSections,
    };
  }

  /**
   * Extract text from CV PDF file
   */
  private async extractCvText(cvUrl: string): Promise<string> {
    try {
      // cvUrl might be a relative path or full path
      let filePath = cvUrl;
      if (!path.isAbsolute(cvUrl)) {
        filePath = path.join(process.cwd(), cvUrl);
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        // Try with uploads/cv prefix
        filePath = path.join(process.cwd(), 'uploads', 'cv', path.basename(cvUrl));
        await fs.access(filePath);
      }

      const dataBuffer = await fs.readFile(filePath);
      const data = await PDFParse(dataBuffer);
      return data.text || '';
    } catch (error) {
      this.logger.warn(`Failed to extract CV text from ${cvUrl}: ${error.message}`);
      return '';
    }
  }
}







