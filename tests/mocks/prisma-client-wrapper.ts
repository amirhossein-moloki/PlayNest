const actualPrisma = require('../../node_modules/@prisma/client');
const prismaEnums = require('./prisma-enums');

module.exports = {
  ...actualPrisma,
  ...prismaEnums,
  $Enums: { ...(actualPrisma.$Enums || {}), ...prismaEnums },
  Prisma: {
    ...(actualPrisma.Prisma || {}), ...prismaEnums,
    TransactionIsolationLevel: { Serializable: 'Serializable', RepeatableRead: 'RepeatableRead' }
  }
};
