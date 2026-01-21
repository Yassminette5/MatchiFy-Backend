import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Skill, SkillDocument } from './schemas/skill.schema';

@Injectable()
export class SkillService {
  constructor(
    @InjectModel(Skill.name) private skillModel: Model<SkillDocument>,
  ) {}

  /**
   * Search skills by query (case-insensitive partial matching)
   * Returns ESCO skills and user-created skills
   */
  async search(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    // Use MongoDB text search for fast case-insensitive partial matching
    const searchRegex = new RegExp(trimmedQuery, 'i');
    
    const skills = await this.skillModel
      .find({ name: searchRegex })
      .sort({ name: 1 }) // Sort alphabetically
      .limit(50) // Limit results
      .lean();

    return skills;
  }

  /**
   * Find skills by IDs
   * Used when validating skill IDs from user profile or portfolio
   */
  async findByIds(skillIds: string[]) {
    if (!skillIds || skillIds.length === 0) {
      return [];
    }
    
    // Filter out invalid ObjectIds to prevent CastError
    const validIds = skillIds.filter(id => {
      if (!id || typeof id !== 'string') {
        return false;
      }
      // Check if it's a valid MongoDB ObjectId (24 hex characters)
      return Types.ObjectId.isValid(id);
    });
    
    if (validIds.length === 0) {
      return [];
    }
    
    return this.skillModel.find({ _id: { $in: validIds } }).lean();
  }

  /**
   * Find a single skill by ID
   */
  async findById(skillId: string) {
    return this.skillModel.findById(skillId).lean();
  }

  /**
   * Find or create a skill by name
   * If skill doesn't exist, create it with source "USER" and createdBy
   */
  async findOrCreateSkill(name: string, createdBy?: string): Promise<SkillDocument> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Skill name cannot be empty');
    }

    // Try to find existing skill (case-insensitive)
    let skill = await this.skillModel.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (!skill) {
      // Create new user skill
      skill = await this.skillModel.create({
        name: trimmedName,
        source: 'USER',
        createdBy: createdBy || undefined,
      });
    }

    return skill;
  }

  /**
   * Create a skill (used by import script)
   * Returns the created skill document, or null if it already exists (duplicate)
   * Never throws errors for duplicates - returns null silently
   */
  async createSkill(name: string, source: 'ESCO' | 'USER' = 'ESCO') {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return null;
    }

    // Check if skill already exists (case-insensitive using collation)
    const existing = await this.skillModel
      .findOne({ name: trimmedName })
      .collation({ locale: 'en', strength: 2 })
      .lean();

    if (existing) {
      return null; // Return null to indicate it was skipped (duplicate)
    }

    try {
      // Create new skill with only name and source (no escoId)
      const newSkill = await this.skillModel.create({
        name: trimmedName,
        source,
      });
      return newSkill;
    } catch (error: any) {
      // If duplicate key error (11000), skill already exists - return null silently
      if (error.code === 11000 || error.code === 11001) {
        return null; // Return null to indicate it was skipped (duplicate)
      }
      // For any other error, re-throw it
      throw error;
    }
  }

  /**
   * Get skill count (for import script verification)
   */
  async count() {
    return this.skillModel.countDocuments();
  }
}

