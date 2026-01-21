import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Portfolio, PortfolioDocument } from './schemas/portfolio.schema';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { UpdatePortfolioDto } from './dto/update-portfolio.dto';
import { MediaItemDto } from './dto/media-item.dto';
import { MediaItem } from './schemas/media-item.schema';
import { SkillService } from '../skill/skill.service';
import { extname } from 'path';

// Allowed extensions for portfolio media
const allowedImageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const allowedVideoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const allowedPdfExtensions = ['.pdf'];

@Injectable()
export class PortfolioService {
  constructor(
    @InjectModel(Portfolio.name) private portfolioModel: Model<PortfolioDocument>,
    private readonly skillService: SkillService,
  ) {}

  /**
   * Create a new portfolio project
   */
  async create(
    talentId: string,
    createDto: CreatePortfolioDto,
    mediaFiles?: Express.Multer.File[],
  ) {
    // Process skills: find or create each skill
    const skillIds: string[] = [];
    if (createDto.skills && createDto.skills.length > 0) {
      if (createDto.skills.length > 10) {
        throw new BadRequestException('Maximum 10 skills allowed');
      }
      
      for (const skillName of createDto.skills) {
        if (typeof skillName === 'string' && skillName.trim()) {
          try {
            // Clean skill name: remove parentheses and extra whitespace
            // Example: "Swift (computer programming)" -> "Swift"
            let cleanedName = skillName.trim();
            // Remove content in parentheses if present
            cleanedName = cleanedName.replace(/\s*\([^)]*\)\s*$/, '').trim();
            
            if (!cleanedName) {
              continue; // Skip empty skill names after cleaning
            }
            
            const skill = await this.skillService.findOrCreateSkill(
              cleanedName,
              talentId
            );
            if (skill && skill._id) {
              skillIds.push(skill._id.toString());
            }
          } catch (error) {
            // Log the error but continue with other skills
            console.error(`Error processing skill "${skillName}":`, error);
            throw new BadRequestException(`Invalid skill: ${skillName}`);
          }
        }
      }
    }

    const projectData: any = {
      talentId,
      title: createDto.title,
      skills: skillIds,
      media: [],
    };

    if (createDto.role) {
      projectData.role = createDto.role;
    }

    if (createDto.description) {
      projectData.description = createDto.description;
    }

    if (createDto.projectLink) {
      projectData.projectLink = createDto.projectLink;
    }

    // Process uploaded files
    if (mediaFiles && mediaFiles.length > 0) {
      const mediaItems: MediaItem[] = [];
      
      for (const file of mediaFiles) {
        const ext = extname(file.originalname).toLowerCase();
        const isImage = allowedImageExtensions.includes(ext);
        const isVideo = allowedVideoExtensions.includes(ext);
        const isPdf = allowedPdfExtensions.includes(ext);

        if (!isImage && !isVideo && !isPdf) {
          throw new BadRequestException(`Invalid file type: ${ext}. Only images, videos, and PDFs are allowed`);
        }

        // Store path relative to uploads folder
        let relativePath = file.path.replace(/\\/g, '/');
        if (relativePath.startsWith('./')) {
          relativePath = relativePath.substring(2);
        }

        const mediaItem: MediaItem = {
          type: isImage ? 'image' : isVideo ? 'video' : 'pdf',
          url: relativePath,
          title: file.originalname,
        };

        mediaItems.push(mediaItem);
      }

      projectData.media = mediaItems;
    }

    // Process media items from DTO (for external links or existing media)
    if (createDto.media && createDto.media.length > 0) {
      const existingMedia = projectData.media || [];
      for (const mediaDto of createDto.media) {
        const mediaItem: MediaItem = {
          type: mediaDto.type,
          url: mediaDto.url,
          title: mediaDto.title,
          externalLink: mediaDto.externalLink,
        };
        existingMedia.push(mediaItem);
      }
      projectData.media = existingMedia;
    }

    const project = await this.portfolioModel.create(projectData);
    const projectObj = project.toObject();
    
    // Populate skills with their names before returning
    if (projectObj.skills && projectObj.skills.length > 0) {
      const skills = await this.skillService.findByIds(projectObj.skills);
      // Replace skill IDs with skill names, filter out any that don't exist
      projectObj.skills = skills.map((skill) => skill.name).filter((name) => name);
    }
    
    return projectObj;
  }

  /**
   * Get all projects for a talent
   */
  async findAllByTalent(talentId: string) {
    const projects = await this.portfolioModel
      .find({ talentId })
      .sort({ createdAt: -1 }) // Newest first
      .lean();
    
    // Populate skills with their names
    const projectsWithSkills = await Promise.all(
      projects.map(async (project) => {
        if (project.skills && project.skills.length > 0) {
          const skills = await this.skillService.findByIds(project.skills);
          // Replace skill IDs with skill names, filter out any that don't exist
          project.skills = skills.map((skill) => skill.name).filter((name) => name);
        }
        return project;
      })
    );
    
    return projectsWithSkills;
  }

  /**
   * Get all projects for a talent by talentId (public access for recruiters)
   * This method does not check ownership, allowing recruiters to view talent portfolios
   */
  async findAllByTalentId(talentId: string) {
    const projects = await this.portfolioModel
      .find({ talentId })
      .sort({ createdAt: -1 }) // Newest first
      .lean();
    
    // Populate skills with their names
    const projectsWithSkills = await Promise.all(
      projects.map(async (project) => {
        if (project.skills && project.skills.length > 0) {
          const skills = await this.skillService.findByIds(project.skills);
          // Replace skill IDs with skill names, filter out any that don't exist
          project.skills = skills.map((skill) => skill.name).filter((name) => name);
        }
        return project;
      })
    );
    
    return projectsWithSkills;
  }

  /**
   * Get a single project by ID
   */
  async findOne(projectId: string, talentId: string) {
    const project = await this.portfolioModel.findById(projectId).lean();

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to access this project');
    }

    // Populate skills with their names
    if (project.skills && project.skills.length > 0) {
      const skills = await this.skillService.findByIds(project.skills);
      // Replace skill IDs with skill names, filter out any that don't exist
      project.skills = skills.map((skill) => skill.name).filter((name) => name);
    }

    return project;
  }

  /**
   * Update a project
   */
  async update(
    projectId: string,
    talentId: string,
    updateDto: UpdatePortfolioDto,
    mediaFiles?: Express.Multer.File[],
  ) {
    const project = await this.portfolioModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to update this project');
    }

    // Update fields
    if (updateDto.title !== undefined) {
      project.title = updateDto.title;
    }

    if (updateDto.role !== undefined) {
      project.role = updateDto.role;
    }

    if (updateDto.skills !== undefined) {
      // Process skills: find or create each skill
      const skillIds: string[] = [];
      if (updateDto.skills.length > 0) {
        if (updateDto.skills.length > 10) {
          throw new BadRequestException('Maximum 10 skills allowed');
        }
        
        for (const skillName of updateDto.skills) {
          if (typeof skillName === 'string' && skillName.trim()) {
            try {
              // Clean skill name: remove parentheses and extra whitespace
              // Example: "Swift (computer programming)" -> "Swift"
              let cleanedName = skillName.trim();
              // Remove content in parentheses if present
              cleanedName = cleanedName.replace(/\s*\([^)]*\)\s*$/, '').trim();
              
              if (!cleanedName) {
                continue; // Skip empty skill names after cleaning
              }
              
              const skill = await this.skillService.findOrCreateSkill(
                cleanedName,
                talentId
              );
              if (skill && skill._id) {
                skillIds.push(skill._id.toString());
              }
            } catch (error) {
              // Log the error but continue with other skills
              console.error(`Error processing skill "${skillName}":`, error);
              throw new BadRequestException(`Invalid skill: ${skillName}`);
            }
          }
        }
      }
      project.skills = skillIds;
    }

    if (updateDto.description !== undefined) {
      project.description = updateDto.description;
    }

    if (updateDto.projectLink !== undefined) {
      project.projectLink = updateDto.projectLink;
    }

    // Handle media updates
    if (updateDto.media !== undefined) {
      // Replace entire media array if provided
      project.media = updateDto.media.map((mediaDto) => ({
        type: mediaDto.type,
        url: mediaDto.url,
        title: mediaDto.title,
        externalLink: mediaDto.externalLink,
      }));
    }

    // Process new uploaded files (append to existing media)
    if (mediaFiles && mediaFiles.length > 0) {
      const existingMedia = project.media || [];
      
      for (const file of mediaFiles) {
        const ext = extname(file.originalname).toLowerCase();
        const isImage = allowedImageExtensions.includes(ext);
        const isVideo = allowedVideoExtensions.includes(ext);
        const isPdf = allowedPdfExtensions.includes(ext);

        if (!isImage && !isVideo && !isPdf) {
          throw new BadRequestException(`Invalid file type: ${ext}. Only images, videos, and PDFs are allowed`);
        }

        let relativePath = file.path.replace(/\\/g, '/');
        if (relativePath.startsWith('./')) {
          relativePath = relativePath.substring(2);
        }

        const mediaItem: MediaItem = {
          type: isImage ? 'image' : isVideo ? 'video' : 'pdf',
          url: relativePath,
          title: file.originalname,
        };

        existingMedia.push(mediaItem);
      }

      project.media = existingMedia;
    }

    await project.save();
    const projectObj = project.toObject();
    
    // Populate skills with their names before returning
    if (projectObj.skills && projectObj.skills.length > 0) {
      const skills = await this.skillService.findByIds(projectObj.skills);
      // Replace skill IDs with skill names, filter out any that don't exist
      projectObj.skills = skills.map((skill) => skill.name).filter((name) => name);
    }
    
    return projectObj;
  }

  /**
   * Delete a project
   */
  async remove(projectId: string, talentId: string) {
    const project = await this.portfolioModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to delete this project');
    }

    await this.portfolioModel.findByIdAndDelete(projectId);
    return { message: 'Project deleted successfully' };
  }
}

