import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
}

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private config: GeminiConfig;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not found in environment variables. AI features will be unavailable.');
      return;
    }

    this.config = {
      apiKey,
      model: this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.0-flash-exp',
      temperature: parseFloat(this.configService.get<string>('GEMINI_TEMPERATURE') || '0.7'),
      maxTokens: parseInt(this.configService.get<string>('GEMINI_MAX_TOKENS') || '8192', 10),
      timeout: parseInt(this.configService.get<string>('GEMINI_TIMEOUT') || '30000', 10),
    };

    try {
      this.genAI = new GoogleGenerativeAI(this.config.apiKey);
      this.logger.log(`Gemini service initialized with model: ${this.config.model}`);
    } catch (error) {
      this.logger.error('Failed to initialize Gemini service', error);
    }
  }

  /**
   * Check if Gemini service is available
   */
  isAvailable(): boolean {
    return this.genAI !== null;
  }

  /**
   * Generate content using Gemini API
   */
  async generateContent(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<GeminiResponse> {
    if (!this.genAI) {
      throw new ServiceUnavailableException(
        'AI service is not available. Please check GEMINI_API_KEY configuration.',
      );
    }

    const startTime = Date.now();
    const model = this.genAI.getGenerativeModel({
      model: this.config.model,
      generationConfig: {
        temperature: options?.temperature ?? this.config.temperature,
        maxOutputTokens: options?.maxTokens ?? this.config.maxTokens,
      },
    });

    try {
      this.logger.debug(`Sending request to Gemini (model: ${this.config.model})`);
      
      const result = await Promise.race([
        model.generateContent(prompt),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Request timeout')),
            this.config.timeout,
          ),
        ),
      ]);

      const response = await result.response;
      const text = response.text();
      const elapsed = Date.now() - startTime;

      // Extract usage information if available
      const usageMetadata = response.usageMetadata;
      const usage = usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount,
            completionTokens: usageMetadata.candidatesTokenCount,
          }
        : undefined;

      this.logger.log(
        `Gemini request completed in ${elapsed}ms${usage ? ` (tokens: ${usage.promptTokens}+${usage.completionTokens})` : ''}`,
      );

      return {
        text,
        usage,
      };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      this.logger.error(
        `Gemini request failed after ${elapsed}ms: ${error.message}`,
        error.stack,
      );

      // Map Gemini errors to user-friendly messages
      if (error.message?.includes('timeout') || error.message?.includes('Request timeout')) {
        throw new ServiceUnavailableException(
          'AI service request timed out. Please try again later.',
        );
      }

      if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        throw new ServiceUnavailableException(
          'AI service authentication failed. Please contact support.',
        );
      }

      if (
        error.message?.includes('quota') ||
        error.message?.includes('rate limit') ||
        error.message?.includes('429') ||
        error.message?.includes('Too Many Requests')
      ) {
        throw new ServiceUnavailableException(
          'AI service quota exceeded. Please try again later or check your API plan.',
        );
      }

      if (error.message?.includes('safety')) {
        throw new BadRequestException(
          'The content could not be processed due to safety restrictions.',
        );
      }

      throw new ServiceUnavailableException(
        'AI service is temporarily unavailable. Please try again later.',
      );
    }
  }

  /**
   * Generate JSON content with retry logic
   */
  async generateJsonContent(
    prompt: string,
    retries: number = 1,
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.generateContent(
          prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any markdown formatting, code blocks, or explanatory text.',
        );

        // Try to extract JSON from response
        let jsonText = response.text.trim();

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
          const lines = jsonText.split('\n');
          lines.shift(); // Remove first line (```json or ```)
          if (lines[lines.length - 1].trim() === '```') {
            lines.pop(); // Remove last line (```)
          }
          jsonText = lines.join('\n').trim();
        }

        // Parse JSON
        const parsed = JSON.parse(jsonText);
        this.logger.debug('Successfully parsed JSON response from Gemini');
        return parsed;
      } catch (error: any) {
        lastError = error;

        // If it's a parsing error and we have retries left, try again
        if (
          (error instanceof SyntaxError || error.message?.includes('JSON')) &&
          attempt < retries
        ) {
          this.logger.warn(
            `Failed to parse JSON response (attempt ${attempt + 1}/${retries + 1}), retrying...`,
          );
          continue;
        }

        // If it's not a parsing error or we're out of retries, throw
        if (!(error instanceof SyntaxError) || attempt >= retries) {
          throw error;
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Failed to generate JSON content');
  }
}

