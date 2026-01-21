import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateZoomMeetingOptions {
  topic: string;
  startTime: Date;
  durationMinutes?: number;
}

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);

  constructor(private readonly configService: ConfigService) {}

  private isEnabled(): boolean {
    return this.configService.get<string>('ZOOM_ENABLED') === 'true';
  }

  /**
   * Crée un meeting Zoom via Server-to-Server OAuth et renvoie join_url + meeting id.
   */
  async createMeeting(
    options: CreateZoomMeetingOptions,
  ): Promise<{ joinUrl: string; meetingId: string }> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        'Zoom integration is not enabled (set ZOOM_ENABLED=true)',
      );
    }

    // Chargement dynamique pour éviter erreurs de build si non installé
    let fetchFn: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      fetchFn = require('node-fetch');
      fetchFn = fetchFn.default || fetchFn;
    } catch (error) {
      this.logger.error(
        'node-fetch package is not installed. Run `npm install node-fetch` to enable Zoom integration.',
      );
      throw new ServiceUnavailableException(
        'Zoom integration is not available on the server',
      );
    }

    const accountId = this.configService.get<string>('ZOOM_ACCOUNT_ID');
    const clientId = this.configService.get<string>('ZOOM_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ZOOM_CLIENT_SECRET');

    if (!accountId || !clientId || !clientSecret) {
      this.logger.error(
        'Missing Zoom credentials. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET in .env',
      );
      throw new ServiceUnavailableException(
        'Zoom credentials are not configured',
      );
    }

    // 1) Récupérer un access token server-to-server
    const token = await this.getAccessToken(
      fetchFn,
      accountId,
      clientId,
      clientSecret,
    );

    // 2) Créer le meeting
    const start = options.startTime;
    const duration = options.durationMinutes ?? 30;

    const response = await fetchFn('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: options.topic,
        type: 2, // scheduled meeting
        start_time: start.toISOString(),
        duration,
        timezone: 'UTC',
        settings: {
          join_before_host: false,
          approval_type: 2,
          waiting_room: true,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Zoom create meeting failed: ${response.status} ${response.statusText} - ${text}`,
      );
      throw new ServiceUnavailableException(
        'Failed to create Zoom meeting (see logs for details)',
      );
    }

    const data = await response.json();
    const joinUrl = data.join_url as string | undefined;
    const meetingId = (data.id || data.uuid || '').toString();

    if (!joinUrl) {
      this.logger.error(
        `Zoom meeting created (id=${meetingId}) but no join_url returned`,
      );
      throw new ServiceUnavailableException(
        'Zoom did not return a join URL for the meeting',
      );
    }

    return { joinUrl, meetingId };
  }

  private async getAccessToken(
    fetchFn: any,
    accountId: string,
    clientId: string,
    clientSecret: string,
  ): Promise<string> {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
      accountId,
    )}`;

    const response = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Zoom OAuth token request failed: ${response.status} ${response.statusText} - ${text}`,
      );
      throw new ServiceUnavailableException(
        'Failed to obtain Zoom access token',
      );
    }

    const data = await response.json();
    if (!data.access_token) {
      this.logger.error(`Zoom OAuth response without access_token: ${data}`);
      throw new ServiceUnavailableException(
        'Zoom OAuth did not return an access token',
      );
    }

    return data.access_token as string;
  }
}


