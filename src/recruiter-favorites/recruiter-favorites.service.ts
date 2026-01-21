import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RecruiterFavorite, RecruiterFavoriteDocument } from './schemas/recruiter-favorite.schema';
import { User, UserDocument } from '../user/schemas/user.schema';

@Injectable()
export class RecruiterFavoritesService {
  constructor(
    @InjectModel(RecruiterFavorite.name)
    private readonly recruiterFavoriteModel: Model<RecruiterFavoriteDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

  /**
   * Add a talent to favorites (for recruiters)
   */
  async addTalentFavorite(talentId: string, recruiterId: string): Promise<RecruiterFavorite> {
    // Validate that talentId is a valid ObjectId
    if (!Types.ObjectId.isValid(talentId)) {
      throw new BadRequestException(`Invalid talent ID format: ${talentId}`);
    }
    
    // Check if talent exists and is actually a talent
    const talent = await this.userModel.findById(talentId).exec();
    if (!talent) {
      throw new NotFoundException(`Talent ${talentId} not found`);
    }

    if (talent.role !== 'talent') {
      throw new BadRequestException(`User ${talentId} is not a talent`);
    }

    // Check if already favorited
    const existing = await this.recruiterFavoriteModel
      .findOne({ recruiterId, talentId })
      .exec();

    if (existing) {
      throw new BadRequestException('Talent is already in favorites');
    }

    // Create favorite
    const favorite = new this.recruiterFavoriteModel({
      recruiterId,
      talentId,
    });

    return favorite.save();
  }

  /**
   * Remove a talent from favorites (for recruiters)
   */
  async removeTalentFavorite(talentId: string, recruiterId: string): Promise<void> {
    const favorite = await this.recruiterFavoriteModel
      .findOneAndDelete({ recruiterId, talentId })
      .exec();

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }
  }

  /**
   * Get all favorite talents for a recruiter
   */
  async getFavoriteTalents(recruiterId: string): Promise<User[]> {
    const favorites = await this.recruiterFavoriteModel
      .find({ recruiterId })
      .sort({ createdAt: -1 })
      .exec();

    const talentIds = favorites.map((f) => f.talentId);

    if (talentIds.length === 0) {
      return [];
    }

    return this.userModel.find({ _id: { $in: talentIds }, role: 'talent' }).exec();
  }

  /**
   * Check if a talent is favorited by a recruiter
   */
  async isTalentFavorite(talentId: string, recruiterId: string): Promise<boolean> {
    const favorite = await this.recruiterFavoriteModel
      .findOne({ recruiterId, talentId })
      .exec();
    return !!favorite;
  }
}

