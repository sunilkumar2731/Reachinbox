import { Client } from '@elastic/elasticsearch';
import { env } from './env';

// Singleton Elasticsearch client
const globalForElastic = globalThis as unknown as {
  elastic: Client | undefined;
};

export const elastic =
  globalForElastic.elastic ??
  new Client({
    node: env.ELASTICSEARCH_URL,
    maxRetries: 1,
    requestTimeout: 2000, // 2s timeout so startup doesn't stall if ES is offline
    ...(env.NODE_ENV === 'development' && {
      tls: { rejectUnauthorized: false },
    }),
  });

if (env.NODE_ENV !== 'production') {
  globalForElastic.elastic = elastic;
}

export const EMAIL_INDEX = 'emails';

/**
 * Ensure the emails index exists with proper mappings.
 * Called once on server start. Safe to run multiple times (idempotent).
 */
export async function ensureEmailIndex(): Promise<void> {
  try {
    const exists = await elastic.indices.exists({ index: EMAIL_INDEX });
    if (exists) return;

    await elastic.indices.create({
      index: EMAIL_INDEX,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' },
          senderId: { type: 'keyword' },
          recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          createdAt: { type: 'date' },
        },
      },
    });

    console.log(`[Elasticsearch] Created index: ${EMAIL_INDEX}`);
  } catch (err) {
    console.warn(`[Elasticsearch] Index initialization skipped: ${(err as Error).message}`);
  }
}
