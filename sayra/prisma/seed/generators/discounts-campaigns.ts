import {
  PrismaClient,
  DiscountTargetType,
  DiscountValueType,
  DiscountFundingSource,
  DiscountCodeType,
} from '@prisma/client';
import { PRNG } from '../prng';
import { SeedCenterDefinition } from './centers';

export async function seedDiscountsAndCampaigns(
  prisma: PrismaClient,
  centers: { id: string; definition: SeedCenterDefinition }[],
  managerIdByCenter: Record<string, string>,
  prng: PRNG
) {
  const createdDiscounts: { id: string; gamingCenterId: string; percent?: number }[] = [];

  for (const center of centers) {
    const managerId = managerIdByCenter[center.id];
    const discount = await prisma.discount.create({
      data: {
        gamingCenterId: center.id,
        targetType: DiscountTargetType.GAMING_CENTER,
        targetId: center.id,
        valueType: DiscountValueType.PERCENTAGE,
        value: 15,
        startAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
        endAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        isActive: true,
        createdByUserId: managerId,
      },
    });

    createdDiscounts.push({
      id: discount.id,
      gamingCenterId: center.id,
      percent: 15,
    });

    if (prng.chance(0.5)) {
      await prisma.discountCampaign.create({
        data: {
          gamingCenterId: center.id,
          name: `جشنواره پاییزه ${center.definition.name}`,
          code: `FALL-${center.definition.slug.slice(0, 3).toUpperCase()}`,
          codeType: DiscountCodeType.PROMO_CODE,
          targetType: DiscountTargetType.GAMING_CENTER,
          targetId: center.id,
          valueType: DiscountValueType.PERCENTAGE,
          value: 20,
          fundingSource: DiscountFundingSource.MERCHANT_FUNDED,
          totalBudget: 5000000,
          usedBudget: 850000,
          startAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
          endAt: new Date(Date.now() + 10 * 24 * 3600 * 1000),
          isActive: true,
        },
      });
    }
  }

  return createdDiscounts;
}
