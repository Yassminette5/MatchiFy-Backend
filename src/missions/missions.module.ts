import { Module } from '@nestjs/common';
import { BestMatchService } from './services/best-match.service';

@Module({
  providers: [BestMatchService],
  exports: [BestMatchService],
})
export class MissionsModule {}
