import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { Offer, OfferSchema } from './schemas/offer.schema';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Offer.name, schema: OfferSchema }]),
    UserModule,
  ],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
