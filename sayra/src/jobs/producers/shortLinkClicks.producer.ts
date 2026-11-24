import { shortLinkClicksQueue } from '../queues';
import { ShortLinkClickEventJobData } from '../../modules/short-links/shortLinks.types';

export async function enqueueShortLinkClickJob(data: ShortLinkClickEventJobData): Promise<void> {
  await shortLinkClicksQueue.add('record-short-link-click', data, {
    removeOnComplete: 500,
    removeOnFail: 200,
  });
}
