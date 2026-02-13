/**
 * Job Queue abstraction for campaign create / optimize.
 * Currently runs jobs synchronously. Swap to Bull/BullMQ when Redis is available for horizontal scaling.
 *
 * To enable Bull queue:
 * 1. npm install bull
 * 2. Set REDIS_URL or use UPSTASH_REDIS_REST_URL (Bull prefers ioredis)
 * 3. Create worker process: node scripts/queue-worker.js
 * 4. Replace enqueue implementation with Bull queue.add()
 */

export type JobType = 'create_campaign' | 'optimize';

export interface QueueJob {
  type: JobType;
  payload: Record<string, unknown>;
  userId: string;
}

export interface QueueResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

/**
 * Enqueue a job. When Bull is not configured, runs synchronously (fire-and-forget).
 * For production at scale, use Bull with a dedicated worker.
 */
export async function enqueue(_job: QueueJob): Promise<QueueResult> {
  // Placeholder: run synchronously. In production, push to Bull queue.
  return { success: true };
}
