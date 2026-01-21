import { Injectable, Logger } from '@nestjs/common';

interface QueuedTask<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  retries: number;
  maxRetries: number;
}

@Injectable()
export class AiQueueService {
  private readonly logger = new Logger(AiQueueService.name);
  private readonly queue: QueuedTask<any>[] = [];
  private readonly activeTasks = new Set<string>();
  private readonly MAX_CONCURRENT = 2; // Maximum 2 appels simultanés
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 seconde
  private isProcessing = false;
  private circuitBreakerOpen = false;
  private circuitBreakerFailures = 0;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 30000; // 30 secondes
  private circuitBreakerResetTimer: NodeJS.Timeout | null = null;

  /**
   * Ajouter une tâche à la queue avec retry automatique
   */
  async enqueue<T>(
    id: string,
    task: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Vérifier le circuit breaker
      if (this.circuitBreakerOpen) {
        this.logger.warn(`Circuit breaker is OPEN. Rejecting task ${id}`);
        reject(new Error('AI service is temporarily unavailable. Circuit breaker is open.'));
        return;
      }

      const queuedTask: QueuedTask<T> = {
        id,
        execute: task,
        resolve,
        reject,
        retries: 0,
        maxRetries,
      };

      this.queue.push(queuedTask);
      this.logger.debug(`Task ${id} added to queue. Queue length: ${this.queue.length}`);

      // Démarrer le traitement si pas déjà en cours
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Traiter la queue avec limite de concurrence
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 || this.activeTasks.size > 0) {
      // Traiter jusqu'à MAX_CONCURRENT tâches en parallèle
      while (
        this.queue.length > 0 &&
        this.activeTasks.size < this.MAX_CONCURRENT &&
        !this.circuitBreakerOpen
      ) {
        const task = this.queue.shift();
        if (!task) {
          break;
        }

        this.activeTasks.add(task.id);
        this.executeTask(task).finally(() => {
          this.activeTasks.delete(task.id);
        });
      }

      // Attendre un peu avant de vérifier à nouveau
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  /**
   * Exécuter une tâche avec retry et exponential backoff
   */
  private async executeTask<T>(task: QueuedTask<T>): Promise<void> {
    try {
      const result = await task.execute();
      this.logger.debug(`Task ${task.id} completed successfully`);
      
      // Réinitialiser le compteur d'échecs en cas de succès
      if (this.circuitBreakerFailures > 0) {
        this.circuitBreakerFailures = Math.max(0, this.circuitBreakerFailures - 1);
      }

      task.resolve(result);
    } catch (error: any) {
      this.logger.warn(
        `Task ${task.id} failed (attempt ${task.retries + 1}/${task.maxRetries + 1}): ${error.message}`,
      );

      // Incrémenter les échecs pour le circuit breaker
      this.circuitBreakerFailures++;

      // Vérifier si on doit ouvrir le circuit breaker
      if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.openCircuitBreaker();
      }

      // Retry avec exponential backoff
      if (task.retries < task.maxRetries) {
        task.retries++;
        const delay = this.INITIAL_RETRY_DELAY * Math.pow(2, task.retries - 1);
        this.logger.debug(`Retrying task ${task.id} after ${delay}ms`);

        await new Promise((resolve) => setTimeout(resolve, delay));

        // Réessayer la tâche
        this.queue.unshift(task);
      } else {
        // Plus de retries disponibles
        this.logger.error(`Task ${task.id} failed after ${task.maxRetries + 1} attempts`);
        task.reject(error);
      }
    }
  }

  /**
   * Ouvrir le circuit breaker
   */
  private openCircuitBreaker(): void {
    if (this.circuitBreakerOpen) {
      return;
    }

    this.circuitBreakerOpen = true;
    this.logger.warn(
      `Circuit breaker OPENED after ${this.circuitBreakerFailures} failures. Will reset in ${this.CIRCUIT_BREAKER_RESET_TIME}ms`,
    );

    // Programmer la réinitialisation
    if (this.circuitBreakerResetTimer) {
      clearTimeout(this.circuitBreakerResetTimer);
    }

    this.circuitBreakerResetTimer = setTimeout(() => {
      this.closeCircuitBreaker();
    }, this.CIRCUIT_BREAKER_RESET_TIME);
  }

  /**
   * Fermer le circuit breaker
   */
  private closeCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.circuitBreakerFailures = 0;
    this.logger.log('Circuit breaker CLOSED. Resuming normal operation.');

    // Redémarrer le traitement de la queue
    if (this.queue.length > 0 && !this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Obtenir les statistiques de la queue
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      activeTasks: this.activeTasks.size,
      circuitBreakerOpen: this.circuitBreakerOpen,
      circuitBreakerFailures: this.circuitBreakerFailures,
    };
  }
}











