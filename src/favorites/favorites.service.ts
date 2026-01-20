import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Favorite, FavoriteDocument } from './schemas/favorite.schema';
import { Mission, MissionDocument } from '../missions/schemas/mission.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(Mission.name)
    private readonly missionModel: Model<MissionDocument>
  ) {}

  /**
   * Add a mission to favorites
   */
  async addFavorite(missionId: string, talentId: string): Promise<Favorite> {
    // Validate that missionId is a valid ObjectId
    if (!Types.ObjectId.isValid(missionId)) {
      throw new BadRequestException(`Invalid mission ID format: ${missionId}`);
    }
    
    // Check if mission exists
    const mission = await this.missionModel.findById(missionId).exec();
    if (!mission) {
      throw new NotFoundException(`Mission ${missionId} not found`);
    }

    // Check if already favorited
    const existing = await this.favoriteModel
      .findOne({ missionId, talentId })
      .exec();

    if (existing) {
      throw new BadRequestException('Mission is already in favorites');
    }

    // Create favorite
    const favorite = new this.favoriteModel({
      missionId,
      talentId,
    });

    return favorite.save();
  }

  /**
   * Remove a mission from favorites
   */
  async removeFavorite(missionId: string, talentId: string): Promise<void> {
    const favorite = await this.favoriteModel
      .findOneAndDelete({ missionId, talentId })
      .exec();

    if (!favorite) {
      throw new NotFoundException('Favorite not found');
    }
  }

  /**
   * Get all favorite missions for a talent
   */
  async getFavorites(talentId: string): Promise<Mission[]> {
    const favorites = await this.favoriteModel
      .find({ talentId })
      .sort({ createdAt: -1 })
      .exec();

    const missionIds = favorites.map((f) => f.missionId);

    if (missionIds.length === 0) {
      return [];
    }

    return this.missionModel.find({ _id: { $in: missionIds } }).exec();
  }

  /**
   * Check if a mission is favorited by a talent
   */
  async isFavorite(missionId: string, talentId: string): Promise<boolean> {
    const favorite = await this.favoriteModel
      .findOne({ missionId, talentId })
      .exec();
    return !!favorite;
  }

  /**
   * Get favorite status for multiple missions
   */
  async getFavoriteStatuses(
    missionIds: string[],
    talentId: string
  ): Promise<Map<string, boolean>> {
    const favorites = await this.favoriteModel
      .find({
        missionId: { $in: missionIds },
        talentId,
      })
      .exec();

    const statusMap = new Map<string, boolean>();
    missionIds.forEach((id) => statusMap.set(id, false));
    favorites.forEach((f) => {
      statusMap.set(f.missionId, true);
    });

    return statusMap;
  }
}


