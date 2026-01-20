import { Injectable, MessageEvent } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MissionDocument } from './schemas/mission.schema';

export type MissionRealtimeEvent =
  | {
      type: 'mission_created';
      mission: Record<string, any>;
    }
  | {
      type: 'mission_updated';
      mission: Record<string, any>;
    }
  | {
      type: 'mission_deleted';
      missionId: string;
    };

@Injectable()
export class MissionsEventsService {
  private missionEvents$ = new Subject<MissionRealtimeEvent>();

  emit(event: MissionRealtimeEvent) {
    this.missionEvents$.next(event);
  }

  stream(): Observable<MessageEvent> {
    return this.missionEvents$.pipe(map((event) => ({ data: event })));
  }

  toPlainMission(mission: MissionDocument): Record<string, any> {
    const plain = mission.toObject({ versionKey: false });
    return {
      ...plain,
      id: plain._id?.toString(),
      _id: plain._id?.toString(),
    };
  }
}

