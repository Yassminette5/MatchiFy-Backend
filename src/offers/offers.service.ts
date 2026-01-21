import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument } from './schemas/offer.schema';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { GetOffersQueryDto } from './dto/get-offers-query.dto';

import { UserService } from '../user/user.service';

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    private readonly userService: UserService,
  ) {}

  /**
   * Create a new offer
   */
  async create(
    createOfferDto: CreateOfferDto,
    talentId: string,
    bannerImage: string,
    galleryImages?: string[],
    introductionVideo?: string,
  ): Promise<Offer> {
    const offer = new this.offerModel({
      ...createOfferDto,
      talentId,
      bannerImage,
      galleryImages: galleryImages || [],
      introductionVideo,
      dateOfPosting: new Date(),
    });

    return offer.save();
  }

  /**
   * Get all offers with optional filters
   */
  async findAll(query: GetOffersQueryDto): Promise<Offer[]> {
    const filter: any = {};

    // Filter by category if provided
    if (query.category) {
      filter.category = query.category;
    }

    // Search in title and keywords if search term provided
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { keywords: { $in: [new RegExp(query.search, 'i')] } },
      ];
    }

    return this.offerModel
      .find(filter)
      .sort({ dateOfPosting: -1 })
      .exec();
  }

  /**
   * Get a single offer by ID
   */
  async findOne(id: string): Promise<Offer> {
    const offer = await this.offerModel.findById(id).exec();

    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    return offer;
  }

  /**
   * Update an offer (only by owner)
   */
  async update(
    id: string,
    updateOfferDto: UpdateOfferDto,
    talentId: string,
    bannerImage?: string,
    galleryImages?: string[],
    introductionVideo?: string,
  ): Promise<Offer> {
    const offer = await this.offerModel.findById(id).exec();

    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    // Check ownership
    if (offer.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to update this offer');
    }

    // Update fields
    const updateData: any = { ...updateOfferDto };
    
    if (bannerImage) {
      updateData.bannerImage = bannerImage;
    }
    
    if (galleryImages) {
      updateData.galleryImages = galleryImages;
    }
    
    if (introductionVideo) {
      updateData.introductionVideo = introductionVideo;
    }

    const updatedOffer = await this.offerModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updatedOffer) {
      throw new NotFoundException(`Offer with ID ${id} not found after update`);
    }

    return updatedOffer;
  }

  /**
   * Delete an offer (only by owner)
   */
  async remove(id: string, talentId: string): Promise<Offer> {
    const offer = await this.offerModel.findById(id).exec();

    if (!offer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }

    // Check ownership
    if (offer.talentId !== talentId) {
      throw new ForbiddenException('You do not have permission to delete this offer');
    }

    const deletedOffer = await this.offerModel.findByIdAndDelete(id).exec();
    
    if (!deletedOffer) {
      throw new NotFoundException(`Offer with ID ${id} not found`);
    }
    
    return deletedOffer;
  }

  /**
   * Get offers by talent ID
   */
  async findByTalent(talentId: string): Promise<Offer[]> {
    return this.offerModel
      .find({ talentId })
      .sort({ dateOfPosting: -1 })
      .exec();
  }

  async addReview(
    offerId: string,
    recruiterId: string,
    rating: number,
    message: string,
  ): Promise<Offer> {
    const offer = await this.offerModel.findById(offerId).exec();
    if (!offer) {
      throw new NotFoundException(`Offer with ID ${offerId} not found`);
    }

    const recruiter = await this.userService.findById(recruiterId);
    if (!recruiter) {
      throw new NotFoundException(`Recruiter with ID ${recruiterId} not found`);
    }

    const review = {
      recruiterId,
      recruiterName: recruiter.fullName,
      rating,
      message,
      createdAt: new Date(),
    };

    offer.reviews.push(review);
    return offer.save();
  }
}
