import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiResponse } from './ai.service';

export interface OllamaConfig {
  url: string;
  model: string;
  timeout: number;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private config: OllamaConfig;
  private isAvailableCache: boolean | null = null;
  private lastCheckTime: number = 0;
  private readonly HEALTH_CHECK_CACHE_MS = 60000; // Cache health check for 1 minute

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('AI_LOCAL_URL', 'http://localhost:7007/analyze');
    const model = this.configService.get<string>('AI_MODEL', 'llama3.1');
    // Increase default timeout to 120 seconds for proposal generation
    const timeout = parseInt(this.configService.get<string>('AI_TIMEOUT', '120000'), 10);

    this.config = {
      url,
      model,
      timeout,
    };

    this.logger.log(`Ollama service initialized with URL: ${this.config.url}, Model: ${this.config.model}`);
    
    // Perform initial health check (non-blocking)
    this.checkHealth().then((isHealthy) => {
      if (isHealthy) {
        this.logger.log(`✅ Ollama service is available and ready`);
      } else {
        this.logger.warn(`⚠️ Ollama service health check failed. Please verify Ollama is running at ${this.config.url}`);
      }
    }).catch((error) => {
      this.logger.warn(`⚠️ Ollama health check error: ${error.message}`);
    });
  }

  /**
   * Check if Ollama service is available
   * Performs actual health check by pinging Ollama
   */
  async checkHealth(): Promise<boolean> {
    // Use cached result if available and recent
    const now = Date.now();
    if (this.isAvailableCache !== null && (now - this.lastCheckTime) < this.HEALTH_CHECK_CACHE_MS) {
      return this.isAvailableCache;
    }

    // Perform actual health check
    try {
      // Extract base URL (remove /api/generate or any path)
      let baseUrl: string;
      if (this.config.url.includes('/api/generate')) {
        baseUrl = this.config.url.replace('/api/generate', '');
      } else {
        // Try to extract base URL from any path
        const urlObj = new URL(this.config.url);
        baseUrl = `${urlObj.protocol}//${urlObj.host}`;
      }
      
      // Use /api/tags endpoint for health check (standard Ollama endpoint)
      const healthCheckUrl = `${baseUrl}/api/tags`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check
      
      try {
        const response = await fetch(healthCheckUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          this.isAvailableCache = true;
          this.lastCheckTime = now;
          this.logger.debug(`Ollama health check passed: ${baseUrl}`);
          return true;
        } else {
          this.isAvailableCache = false;
          this.lastCheckTime = now;
          this.logger.warn(`Ollama health check failed: ${response.status} at ${healthCheckUrl}`);
          return false;
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError' || controller.signal.aborted) {
          this.logger.warn(`Ollama health check timed out at ${healthCheckUrl}`);
        } else {
          const errorCode = fetchError.cause?.code || fetchError.code;
          if (errorCode === 'ECONNREFUSED' || fetchError.message?.includes('ECONNREFUSED')) {
            this.logger.error(`Cannot connect to Ollama at ${baseUrl}. Is Ollama running?`);
          } else {
            this.logger.warn(`Ollama health check failed: ${fetchError.message} at ${healthCheckUrl}`);
          }
        }
        
        this.isAvailableCache = false;
        this.lastCheckTime = now;
        return false;
      }
    } catch (error: any) {
      this.logger.warn(`Ollama health check error: ${error.message}`);
      this.isAvailableCache = false;
      this.lastCheckTime = now;
      return false;
    }
  }

  /**
   * Check if Ollama service is available (synchronous, uses cache)
   */
  isAvailable(): boolean {
    // Use cached result if available and recent
    const now = Date.now();
    if (this.isAvailableCache !== null && (now - this.lastCheckTime) < this.HEALTH_CHECK_CACHE_MS) {
      return this.isAvailableCache;
    }

    // If cache expired, assume available (will be updated on next request)
    // This prevents blocking while health check runs
    return this.isAvailableCache ?? true;
  }

  /**
   * Generate content using Ollama API with streaming support
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
    const startTime = Date.now();

    // Quick health check before making request
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      throw new ServiceUnavailableException(
        `Ollama service is not available at ${this.config.url}. Please ensure Ollama is running.`,
      );
    }

    try {
      this.logger.debug(`Sending streaming request to Ollama (model: ${this.config.model})`);

      // Check if we're using Ollama native API or a wrapper service
      const isOllamaNative = this.config.url.includes('/api/generate');
      
      // Prepare request body - always enable streaming
      const requestBody = isOllamaNative
        ? {
            model: this.config.model,
            prompt,
            stream: true, // Force streaming enabled
            options: {
              ...(options?.temperature !== undefined && { temperature: options.temperature }),
              ...(options?.maxTokens !== undefined && { num_predict: options.maxTokens }),
            },
          }
        : {
            prompt,
            model: this.config.model,
            stream: true,
            ...(options?.temperature !== undefined && { temperature: options.temperature }),
            ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
          };

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.config.timeout);

      try {
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if request was aborted (timeout)
        if (controller.signal.aborted) {
          throw new ServiceUnavailableException(
            'AI service request timed out. Please try again later.',
          );
        }

        // Check response status
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          if (response.status === 503 || response.status === 502) {
            this.isAvailableCache = false;
            throw new ServiceUnavailableException(
              'AI service is temporarily unavailable. Please try again later.',
            );
          }

          if (response.status === 400) {
            throw new BadRequestException(
              'Invalid request to AI service.',
            );
          }

          this.logger.error(`Ollama API returned error ${response.status}: ${errorText}`);
          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable. Please try again later.',
          );
        }

        // Parse streaming response
        const elapsed = Date.now() - startTime;
        let fullResponse = '';
        let lastUsage: any = null;

        if (isOllamaNative) {
          // Ollama native API format with streaming
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          
          if (!reader) {
            throw new ServiceUnavailableException('Failed to read streaming response');
          }

          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            // Decode the chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines (NDJSON format)
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const chunk = JSON.parse(line);
                  
                  if (chunk.response) {
                    fullResponse += chunk.response;
                    // Invoke callback with the chunk
                    onChunk(chunk.response);
                  }
                  
                  if (chunk.done && chunk.prompt_eval_count) {
                    lastUsage = {
                      promptTokens: chunk.prompt_eval_count,
                      completionTokens: chunk.eval_count,
                    };
                  }
                } catch (parseError) {
                  this.logger.warn(`Failed to parse streaming chunk: ${line}`);
                }
              }
            }
          }
          
          // Process any remaining buffer
          if (buffer.trim()) {
            try {
              const chunk = JSON.parse(buffer);
              if (chunk.response) {
                fullResponse += chunk.response;
                onChunk(chunk.response);
              }
              if (chunk.done && chunk.prompt_eval_count) {
                lastUsage = {
                  promptTokens: chunk.prompt_eval_count,
                  completionTokens: chunk.eval_count,
                };
              }
            } catch (parseError) {
              this.logger.warn(`Failed to parse final chunk: ${buffer}`);
            }
          }
        } else {
          // Wrapper service format - fallback to non-streaming parsing
          const responseText = await response.text();
          const lines = responseText.trim().split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const chunk = JSON.parse(line);
                if (chunk.response || chunk.text || chunk.content) {
                  const text = chunk.response || chunk.text || chunk.content;
                  fullResponse += text;
                  onChunk(text);
                }
              } catch (parseError) {
                this.logger.warn(`Failed to parse streaming chunk: ${line}`);
              }
            }
          }
        }

        this.logger.log(
          `Ollama streaming request completed in ${elapsed}ms${lastUsage ? ` (tokens: ${lastUsage.promptTokens || '?'}+${lastUsage.completionTokens || '?'})` : ''}`,
        );

        this.isAvailableCache = true;
        this.lastCheckTime = Date.now();

        return {
          text: fullResponse,
          usage: lastUsage || undefined,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        if (fetchError.name === 'AbortError' || controller.signal.aborted) {
          const elapsed = Date.now() - startTime;
          this.logger.error(
            `Ollama request timed out after ${elapsed}ms (timeout: ${this.config.timeout}ms) at ${this.config.url}`,
          );
          throw new ServiceUnavailableException(
            `AI service request timed out after ${Math.round(this.config.timeout / 1000)}s. Ollama may be slow or overloaded. Please try again later.`,
          );
        }

        // Handle network errors
        const errorCode = fetchError.cause?.code || fetchError.code;
        const errorMessage = fetchError.message || '';
        
        if (
          errorCode === 'ECONNREFUSED' ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('connect ECONNREFUSED')
        ) {
          this.isAvailableCache = false;
          this.logger.error(
            `Failed to connect to Ollama server at ${this.config.url}. Please ensure:`,
          );
          this.logger.error(`1. Ollama server is running`);
          this.logger.error(`2. URL is correct: ${this.config.url}`);
          this.logger.error(`3. Port ${new URL(this.config.url).port || 'default'} is accessible`);
          
          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable. Please ensure the local Ollama server is running.',
          );
        }

        // Log the full error for debugging
        this.logger.error(`Ollama fetch error: ${errorMessage}`, {
          code: errorCode,
          url: this.config.url,
          stack: fetchError.stack,
        });

        throw fetchError;
      }
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      
      // Re-throw ServiceUnavailableException and BadRequestException as-is
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Ollama streaming request failed after ${elapsed}ms: ${error.message}`,
        error.stack,
      );

      // Mark as unavailable on network errors
      if (error.message?.includes('unavailable') || error.message?.includes('ECONNREFUSED')) {
        this.isAvailableCache = false;
      }

      throw new ServiceUnavailableException(
        'AI service is temporarily unavailable. Please try again later.',
      );
    }
  }

  /**
   * Generate content using Ollama API (non-streaming)
   */
  async generateContent(
    prompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<AiResponse> {
    const startTime = Date.now();

    // Quick health check before making request
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      throw new ServiceUnavailableException(
        `Ollama service is not available at ${this.config.url}. Please ensure Ollama is running.`,
      );
    }

    try {
      this.logger.debug(`Sending request to Ollama (model: ${this.config.model})`);

      // Check if we're using Ollama native API or a wrapper service
      const isOllamaNative = this.config.url.includes('/api/generate');
      
      // Prepare request body based on API type
      const requestBody = isOllamaNative
        ? {
            model: this.config.model,
            prompt,
            stream: true, // Enable streaming for better handling of long responses
            options: {
              ...(options?.temperature !== undefined && { temperature: options.temperature }),
              ...(options?.maxTokens !== undefined && { num_predict: options.maxTokens }),
            },
          }
        : {
            prompt,
            model: this.config.model,
            ...(options?.temperature !== undefined && { temperature: options.temperature }),
            ...(options?.maxTokens !== undefined && { max_tokens: options.maxTokens }),
          };

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.config.timeout);

      try {
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if request was aborted (timeout)
        if (controller.signal.aborted) {
          throw new ServiceUnavailableException(
            'AI service request timed out. Please try again later.',
          );
        }

        // Check response status
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          if (response.status === 503 || response.status === 502) {
            this.isAvailableCache = false;
            throw new ServiceUnavailableException(
              'AI service is temporarily unavailable. Please try again later.',
            );
          }

          if (response.status === 400) {
            throw new BadRequestException(
              'Invalid request to AI service.',
            );
          }

          this.logger.error(`Ollama API returned error ${response.status}: ${errorText}`);
          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable. Please try again later.',
          );
        }

        // Parse response
        const elapsed = Date.now() - startTime;

        // Extract text from response (adapt based on API type)
        let text: string;
        let usage: { promptTokens?: number; completionTokens?: number } | undefined;

        if (isOllamaNative) {
          // Ollama native API format with streaming
          const responseText = await response.text();
          
          // If streaming, parse NDJSON (newline-delimited JSON)
          if (requestBody.stream) {
            const lines = responseText.trim().split('\n');
            let fullResponse = '';
            let lastUsage: any = null;
            
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const chunk = JSON.parse(line);
                  if (chunk.response) {
                    fullResponse += chunk.response;
                  }
                  if (chunk.done && chunk.prompt_eval_count) {
                    lastUsage = {
                      promptTokens: chunk.prompt_eval_count,
                      completionTokens: chunk.eval_count,
                    };
                  }
                } catch (parseError) {
                  this.logger.warn(`Failed to parse streaming chunk: ${line}`);
                }
              }
            }
            
            text = fullResponse;
            usage = lastUsage || undefined;
          } else {
            // Non-streaming response
            const responseData = JSON.parse(responseText);
            text = responseData.response || '';
            usage = {
              promptTokens: responseData.prompt_eval_count,
              completionTokens: responseData.eval_count,
            };
          }
        } else {
          // Wrapper service format
          const responseData = await response.json();
          
          if (typeof responseData === 'string') {
            text = responseData;
          } else if (responseData.text) {
            text = responseData.text;
          } else if (responseData.response) {
            text = responseData.response;
          } else if (responseData.content) {
            text = responseData.content;
          } else if (responseData.message?.content) {
            text = responseData.message.content;
          } else {
            // Fallback: try to stringify the whole response
            text = JSON.stringify(responseData);
            this.logger.warn('Unexpected response format, using stringified response');
          }

          // Extract usage if available
          usage = responseData.usage ? {
            promptTokens: responseData.usage.prompt_tokens || responseData.usage.promptTokens,
            completionTokens: responseData.usage.completion_tokens || responseData.usage.completionTokens,
          } : undefined;
        }

        this.logger.log(
          `Ollama request completed in ${elapsed}ms${usage ? ` (tokens: ${usage.promptTokens || '?'}+${usage.completionTokens || '?'})` : ''}`,
        );

        this.isAvailableCache = true;
        this.lastCheckTime = Date.now();

        return {
          text,
          usage,
        };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        if (fetchError.name === 'AbortError' || controller.signal.aborted) {
          const elapsed = Date.now() - startTime;
          this.logger.error(
            `Ollama request timed out after ${elapsed}ms (timeout: ${this.config.timeout}ms) at ${this.config.url}`,
          );
          throw new ServiceUnavailableException(
            `AI service request timed out after ${Math.round(this.config.timeout / 1000)}s. Ollama may be slow or overloaded. Please try again later.`,
          );
        }

        // Handle network errors
        const errorCode = fetchError.cause?.code || fetchError.code;
        const errorMessage = fetchError.message || '';
        
        if (
          errorCode === 'ECONNREFUSED' ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('connect ECONNREFUSED')
        ) {
          this.isAvailableCache = false;
          this.logger.error(
            `Failed to connect to Ollama server at ${this.config.url}. Please ensure:`,
          );
          this.logger.error(`1. Ollama server is running`);
          this.logger.error(`2. URL is correct: ${this.config.url}`);
          this.logger.error(`3. Port ${new URL(this.config.url).port || 'default'} is accessible`);
          
          throw new ServiceUnavailableException(
            'AI service is temporarily unavailable. Please ensure the local Ollama server is running.',
          );
        }

        // Log the full error for debugging
        this.logger.error(`Ollama fetch error: ${errorMessage}`, {
          code: errorCode,
          url: this.config.url,
          stack: fetchError.stack,
        });

        throw fetchError;
      }
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      
      // Re-throw ServiceUnavailableException and BadRequestException as-is
      if (error instanceof ServiceUnavailableException || error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Ollama request failed after ${elapsed}ms: ${error.message}`,
        error.stack,
      );

      // Mark as unavailable on network errors
      if (error.message?.includes('unavailable') || error.message?.includes('ECONNREFUSED')) {
        this.isAvailableCache = false;
      }

      throw new ServiceUnavailableException(
        'AI service is temporarily unavailable. Please try again later.',
      );
    }
  }
}

