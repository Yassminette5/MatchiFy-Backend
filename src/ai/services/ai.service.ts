import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { OllamaService } from './ollama.service';

export interface AiResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export type AiProvider = 'local' | 'gemini' | 'openai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private provider: AiProvider;

  constructor(
    private configService: ConfigService,
    private readonly geminiService: GeminiService,
    private readonly ollamaService: OllamaService,
  ) {
    const provider = this.configService.get<string>('AI_PROVIDER', 'local').toLowerCase();
    
    // Map provider names
    if (provider === 'local' || provider === 'ollama') {
      this.provider = 'local';
    } else if (provider === 'gemini' || provider === 'google') {
      this.provider = 'gemini';
    } else {
      this.logger.warn(`Unknown AI provider: ${provider}. Defaulting to local.`);
      this.provider = 'local';
    }

    this.logger.log(`AI Service initialized with provider: ${this.provider}`);
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    if (this.provider === 'local') {
      return this.ollamaService.isAvailable();
    } else if (this.provider === 'gemini') {
      return this.geminiService.isAvailable();
    }
    return false;
  }

  /**
   * Generate content using the configured AI provider
   */
  async generateContent(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<AiResponse> {
    if (!this.isAvailable()) {
      throw new ServiceUnavailableException(
        'AI service is not available. Please check configuration.',
      );
    }

    const startTime = Date.now();
    this.logger.debug(`Generating content with provider: ${this.provider}`);

    try {
      let response: AiResponse;

      if (this.provider === 'local') {
        response = await this.ollamaService.generateContent(prompt, options);
      } else if (this.provider === 'gemini') {
        response = await this.geminiService.generateContent(prompt, options);
      } else {
        throw new ServiceUnavailableException(
          `Unsupported AI provider: ${this.provider}`,
        );
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`AI request completed in ${elapsed}ms (provider: ${this.provider})`);

      return response;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      this.logger.error(
        `AI request failed after ${elapsed}ms (provider: ${this.provider}): ${error.message}`,
        error.stack,
      );

      // Map errors to user-friendly messages
      if (error instanceof ServiceUnavailableException) {
        throw new ServiceUnavailableException(
          'AI service is temporarily unavailable. Please try again later.',
        );
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new ServiceUnavailableException(
        'AI service is temporarily unavailable. Please try again later.',
      );
    }
  }

  /**
   * Generate content using the configured AI provider with streaming support
   * @param prompt The prompt to send to the AI
   * @param onChunk Callback function invoked for each chunk of streamed text
   * @param options Generation options (temperature, maxTokens)
   * @returns Final AI response with complete text and usage stats
   */
  async generateContentStream(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<AiResponse> {
    if (!this.isAvailable()) {
      throw new ServiceUnavailableException(
        'AI service is not available. Please check configuration.',
      );
    }

    const startTime = Date.now();
    this.logger.debug(`Generating streaming content with provider: ${this.provider}`);

    try {
      let response: AiResponse;

      if (this.provider === 'local') {
        response = await this.ollamaService.generateContentStream(prompt, onChunk, options);
      } else if (this.provider === 'gemini') {
        // Gemini doesn't support streaming yet, fallback to non-streaming
        this.logger.warn('Gemini provider does not support streaming, using non-streaming mode');
        response = await this.geminiService.generateContent(prompt, options);
        // Send the entire response as one chunk
        onChunk(response.text);
      } else {
        throw new ServiceUnavailableException(
          `Unsupported AI provider: ${this.provider}`,
        );
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`AI streaming request completed in ${elapsed}ms (provider: ${this.provider})`);

      return response;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      this.logger.error(
        `AI streaming request failed after ${elapsed}ms (provider: ${this.provider}): ${error.message}`,
        error.stack,
      );

      // Map errors to user-friendly messages
      if (error instanceof ServiceUnavailableException) {
        throw new ServiceUnavailableException(
          'AI service is temporarily unavailable. Please try again later.',
        );
      }

      if (error instanceof BadRequestException) {
        throw error;
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
    if (!this.isAvailable()) {
      throw new ServiceUnavailableException(
        'AI service is not available. Please check configuration.',
      );
    }

    let lastError: Error | null = null;
    const jsonPrompt = prompt + '\n\nIMPORTANT: Respond ONLY with valid JSON. Do not include any markdown formatting, code blocks, or explanatory text.';

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.generateContent(jsonPrompt);

        // Try to extract JSON from response
        let jsonText = response.text.trim();

        // Remove markdown code blocks if present
        if (jsonText.startsWith('```')) {
          const lines = jsonText.split('\n');
          lines.shift(); // Remove first line (```json or ```)
          if (lines[lines.length - 1]?.trim() === '```') {
            lines.pop(); // Remove last line (```)
          }
          jsonText = lines.join('\n').trim();
        }

        // Remove any text before the first {
        const firstBrace = jsonText.indexOf('{');
        if (firstBrace > 0) {
          jsonText = jsonText.substring(firstBrace);
        }

        // Remove any text after the last }
        const lastBrace = jsonText.lastIndexOf('}');
        if (lastBrace >= 0 && lastBrace < jsonText.length - 1) {
          jsonText = jsonText.substring(0, lastBrace + 1);
        }

        // Parse JSON
        const parsed = JSON.parse(jsonText);
        this.logger.debug(`Successfully parsed JSON response from ${this.provider} (attempt ${attempt + 1})`);
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
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 500));
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

  /**
   * Get current provider
   */
  getProvider(): AiProvider {
    return this.provider;
  }
}

