import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CreateMeetEventOptions {
  summary: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes?: number;
  attendeesEmails?: string[];
}

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Crée un évènement dans Google Calendar avec un lien Meet.
   * Cette méthode est conçue pour échouer proprement si l'intégration
   * n'est pas configurée (pas de crash du serveur).
   */
  async createMeetEvent(
    options: CreateMeetEventOptions,
  ): Promise<{ meetLink: string; eventId: string }> {
    const enabled =
      this.configService.get<string>('GOOGLE_CALENDAR_ENABLED') === 'true';

    if (!enabled) {
      throw new ServiceUnavailableException(
        'Google Calendar integration is not enabled',
      );
    }

    let google: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ({ google } = require('googleapis'));
    } catch (error) {
      this.logger.error(
        'googleapis package is not installed. Run `npm install googleapis` to enable Google Calendar integration.',
      );
      throw new ServiceUnavailableException(
        'Google Calendar integration is not available on the server',
      );
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const refreshToken =
      this.configService.get<string>('GOOGLE_REFRESH_TOKEN');
    const calendarId =
      this.configService.get<string>('GOOGLE_CALENDAR_ID') ||
      'primary';

    if (!clientId || !clientSecret || !refreshToken) {
      this.logger.error(
        'Missing Google Calendar credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REFRESH_TOKEN in .env',
      );
      throw new ServiceUnavailableException(
        'Google Calendar credentials are not configured',
      );
    }

    const { OAuth2 } = google.auth;
    const oAuth2Client = new OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({
      version: 'v3',
      auth: oAuth2Client,
    });

    const start = options.scheduledAt;
    const end = new Date(
      start.getTime() + (options.durationMinutes ?? 30) * 60 * 1000,
    );

    const attendees =
      options.attendeesEmails?.map((email) => ({ email })) ?? [];

    const eventRequest = {
      summary: options.summary,
      description: options.description,
      start: {
        dateTime: start.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: 'UTC',
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `matchify-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    try {
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventRequest,
        conferenceDataVersion: 1,
      });

      const event = response.data;
      const eventId = event.id as string;

      const hangoutLink =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find(
          (ep: any) => ep.entryPointType === 'video',
        )?.uri;

      if (!hangoutLink) {
        this.logger.error(
          `Google Calendar event created (id=${eventId}) but no Meet link was returned`,
        );
        throw new ServiceUnavailableException(
          'Failed to obtain Meet link from Google Calendar',
        );
      }

      return { meetLink: hangoutLink, eventId };
    } catch (error: any) {
      this.logger.error(
        `Failed to create Google Calendar event: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Failed to create Google Calendar event',
      );
    }
  }
}


