import { Worker, Job } from 'bullmq';
import { CMS_SYNC_MEDIA_QUEUE_NAME } from '../queues';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import logger from '../../config/logger';
import { requestContext } from '../../common/context/request-context';
import { Metrics } from '../../common/metrics/metrics';

export interface CmsSyncMediaJobData {
  postId: string;
  correlationId?: string;
}

export const cmsSyncMediaWorker = new Worker(
  CMS_SYNC_MEDIA_QUEUE_NAME,
  async (job: Job<CmsSyncMediaJobData>) => {
    const { postId, correlationId } = job.data;

    return requestContext.run({ correlationId, requestId: job.id }, async () => {
      logger.info({ msg: 'Processing CMS Sync Media job', jobId: job.id, postId });

      try {
        const post = await prisma.post.findUnique({
          where: { id: postId },
          select: { content: true, coverMediaId: true, ogImageId: true },
        });

        if (!post) {
          logger.warn({ msg: 'Post not found for media sync', postId });
          return;
        }

        // We can link coverMedia and ogImage to the post media attachments if they are set
        const mediaAttachments: { mediaId: string; type: string }[] = [];

        if (post.coverMediaId) {
          mediaAttachments.push({ mediaId: post.coverMediaId, type: 'cover' });
        }
        if (post.ogImageId) {
          mediaAttachments.push({ mediaId: post.ogImageId, type: 'og-image' });
        }

        // Parse content to extract media IDs (e.g. searching for media id patterns in content URLs)
        // If content contains standard cuid or uuid patterns referencing media files:
        const mediaIdRegex = /media\/([a-zA-Z0-9_-]{10,})/g;
        let match;
        while ((match = mediaIdRegex.exec(post.content)) !== null) {
          const mediaId = match[1];
          // Verify if the mediaId actually exists in database
          const mediaExists = await prisma.media.findUnique({ where: { id: mediaId } });
          if (mediaExists) {
            mediaAttachments.push({ mediaId, type: 'in-content' });
          }
        }

        // Perform bulk/transactional update of PostMedia relations
        if (mediaAttachments.length > 0) {
          await prisma.$transaction(async (tx) => {
            for (const attachment of mediaAttachments) {
              await tx.postMedia.upsert({
                where: {
                  postId_mediaId_attachmentType: {
                    postId,
                    mediaId: attachment.mediaId,
                    attachmentType: attachment.type,
                  },
                },
                update: {
                  isActive: true,
                },
                create: {
                  postId,
                  mediaId: attachment.mediaId,
                  attachmentType: attachment.type,
                },
              });
            }
          });
        }

        logger.info({ msg: 'CMS Sync Media job completed successfully', postId, attachmentsCount: mediaAttachments.length });
      } catch (error) {
        Metrics.recordWorkerError(CMS_SYNC_MEDIA_QUEUE_NAME, error instanceof Error ? error.message : String(error));
        logger.error({ msg: 'CMS Sync Media job failed', jobId: job.id, error });
        throw error;
      }
    });
  },
  {
    connection: {
      url: env.REDIS_URL,
    },
  }
);

cmsSyncMediaWorker.on('completed', (job) => {
  logger.info({ msg: 'CMS Sync Media job completed event', jobId: job.id });
});

cmsSyncMediaWorker.on('failed', (job, err) => {
  logger.error({ msg: 'CMS Sync Media job failed event', jobId: job?.id, error: err });
});
