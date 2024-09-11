import express from 'express';
import storage from '../storage/index.js';

const router = express.Router();

/**
 * Create a new debitCard
 */
router.post('/', async (req, res) => {
  try {
    const debitCard = await storage.model('DebitCard').create(req.body);
    return res.status(200).json(debitCard._filter());
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a debit card by id to be active or inactive
 */
router.put('/:debitCardId', async (req, res) => {
  try {
    const { debitCardId } = req.params;
    if (!debitCardId) { return res.status(400).json({ error: 'debitCardId required' }); }
    const { active } = req.body;
    if (typeof active !== 'boolean') { return res.status(400).json({ error: 'active required as boolean' }); }

    const debitCard = await storage.model('DebitCard').findOne({ _id: debitCardId });
    if (!debitCard) { return res.status(400).json({ error: 'Debit card not found' }); }

    const updatedDebitCard = active ? await debitCard.setActive() : await debitCard.setInactive();
    const filteredDebitCard = updatedDebitCard._filter();
    return res.status(200).json(filteredDebitCard);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a debit card by id
 */
router.get('/:debitCardId', async (req, res) => {
  try {
    const { debitCardId } = req.params;
    if (!debitCardId) { return res.status(400).json({ error: 'debitCardId required' }); }

    const debitCard = await storage.model('DebitCard').findOne({ _id: debitCardId });

    const filteredDebitCard = debitCard?._filter();
    return res.status(200).json(filteredDebitCard || {});
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a debit card balances by id
 */
router.get('/balances/:debitCardId', async (req, res) => {
  try {
    const { debitCardId } = req.params;
    if (!debitCardId) { return res.status(400).json({ error: 'debitCardId required' }); }

    const debitCard = await storage.model('DebitCard').findOne({ _id: debitCardId });
    if (!debitCard) { return res.status(400).json({ error: 'Debit card not found' }); }

    const balances = await debitCard.getBalances();
    return res.status(200).json(balances);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/debitcards' };
