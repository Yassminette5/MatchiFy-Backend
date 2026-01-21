import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rating, RatingDocument } from './schemas/rating.schema';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name)
    private readonly ratingModel: Model<RatingDocument>,
  ) {}

  /**
   * Crée ou met à jour un rating pour un talent donné par le recruteur courant.
   * La clé d'unicité est (recruiterId, talentId, missionId).
   */
  async createOrUpdate(
    recruiterId: string,
    dto: CreateRatingDto,
  ): Promise<RatingDocument> {
    const filter: any = {
      recruiterId,
      talentId: dto.talentId,
      missionId: dto.missionId || null,
    };

    const update: Partial<Rating> = {
      score: dto.score,
      recommended: dto.recommended,
      comment: dto.comment,
      tags: dto.tags || [],
    };

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    const rating = await this.ratingModel
      .findOneAndUpdate(filter, update, options)
      .exec();

    if (!rating) {
      throw new NotFoundException('Failed to create or update rating');
    }

    return rating;
  }

  /**
   * Retourne le rating d'un recruteur pour un talent / mission.
   */
  async findMyRating(
    recruiterId: string,
    talentId: string,
    missionId?: string,
  ): Promise<RatingDocument | null> {
    const filter: any = {
      recruiterId,
      talentId,
    };

    if (missionId) {
      filter.missionId = missionId;
    }

    return this.ratingModel.findOne(filter).exec();
  }

  /**
   * Retourne les ratings publics pour un talent (tous les recruteurs).
   * Utile pour afficher une moyenne et les feedbacks sur la fiche talent.
   */
  async findForTalent(talentId: string) {
    const ratings = await this.ratingModel
      .find({ talentId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!ratings.length) {
      return {
        talentId,
        averageScore: null,
        count: 0,
        ratings: [],
      };
    }

    const sum = ratings.reduce((acc, r) => acc + (r.score || 0), 0);
    const averageScore = sum / ratings.length;

    return {
      talentId,
      averageScore: Number(averageScore.toFixed(2)),
      count: ratings.length,
      ratings,
    };
  }

  /**
   * Supprime un rating si et seulement s'il appartient au recruteur donné.
   * Retourne le rating supprimé.
   */
  async deleteRating(
    ratingId: string,
    recruiterId: string,
  ): Promise<RatingDocument> {
    const rating = await this.ratingModel.findById(ratingId).exec();

    if (!rating) {
      throw new NotFoundException('Rating introuvable');
    }

    if (rating.recruiterId.toString() !== recruiterId) {
      throw new ForbiddenException(
        "Vous n'avez pas la permission de supprimer ce rating",
      );
    }

    await rating.deleteOne();
    return rating;
  }
}


