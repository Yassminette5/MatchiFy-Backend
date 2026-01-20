import { Injectable } from '@nestjs/common';

@Injectable()
export class BestMatchService {
  async refreshRankings(userId: string): Promise<void> {
    return;
  }
}
