import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.ok({ status: 'ok' });
});

export default router;
