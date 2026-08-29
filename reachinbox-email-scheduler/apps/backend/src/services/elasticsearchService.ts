import { elastic, EMAIL_INDEX } from '../config/elasticsearch';
import { Email, EmailStatus } from '@prisma/client';

export interface ElasticsearchEmailDoc {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export class ElasticsearchService {
  /**
   * Indexes a newly scheduled email document into Elasticsearch.
   * Safe fail-open: does not throw if Elasticsearch is temporarily offline.
   */
  static async indexEmail(email: Email): Promise<void> {
    try {
      const doc: ElasticsearchEmailDoc = {
        id: email.id,
        userId: email.userId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt?.toISOString() || null,
        failedAt: email.failedAt?.toISOString() || null,
        errorMessage: email.errorMessage || null,
        createdAt: email.createdAt.toISOString(),
      };

      await elastic.index({
        index: EMAIL_INDEX,
        id: email.id,
        document: doc,
        refresh: 'wait_for',
      });
    } catch (err) {
      console.warn(`[Elasticsearch] Failed to index email ${email.id} (non-fatal):`, (err as Error).message);
    }
  }

  /**
   * Updates an existing email document's status in Elasticsearch.
   */
  static async updateEmailStatus(
    emailId: string,
    status: EmailStatus,
    extra?: { sentAt?: Date; failedAt?: Date; errorMessage?: string }
  ): Promise<void> {
    try {
      const doc: Partial<ElasticsearchEmailDoc> = {
        status,
        ...(extra?.sentAt && { sentAt: extra.sentAt.toISOString() }),
        ...(extra?.failedAt && { failedAt: extra.failedAt.toISOString() }),
        ...(extra?.errorMessage !== undefined && { errorMessage: extra.errorMessage }),
      };

      await elastic.update({
        index: EMAIL_INDEX,
        id: emailId,
        doc,
        doc_as_upsert: true,
        refresh: 'wait_for',
      });
    } catch (err) {
      console.warn(`[Elasticsearch] Failed to update email ${emailId} status (non-fatal):`, (err as Error).message);
    }
  }

  /**
   * Searches emails matching a query keyword across recipient, subject, and body,
   * scoped strictly to the authenticated user.
   */
  static async searchUserEmails(
    userId: string,
    query: string
  ): Promise<ElasticsearchEmailDoc[]> {
    try {
      if (!query || !query.trim()) {
        return [];
      }

      const response = await elastic.search<ElasticsearchEmailDoc>({
        index: EMAIL_INDEX,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query.trim(),
                  fields: ['recipient^3', 'subject^2', 'body'],
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [
              {
                term: {
                  userId: userId,
                },
              },
            ],
          },
        },
        sort: [
          {
            scheduledAt: { order: 'desc' },
          },
        ],
        size: 100,
      });

      return response.hits.hits.map((hit) => hit._source as ElasticsearchEmailDoc);
    } catch (err) {
      console.warn(`[Elasticsearch] Search query failed:`, (err as Error).message);
      return [];
    }
  }
}
