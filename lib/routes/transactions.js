import express from 'express';
import storage from '../storage/index.js';
import HandledError from '../util/handledError.js';

const router = express.Router();

/**
 * Create a new transaction
 */
router.post('/', async (req, res) => {
  try {
    const { type, subtype } = req.body;
    if (type === 'debit' && subtype !== 'credit') {
      throw new HandledError('Debit transactions must have a "credit" subtype', 400);
    }
    if (type === 'withdrawal' && subtype !== 'purchase') {
      throw new HandledError('Withdrawal transactions must have a "purchase" subtype', 400);
    }
    const transaction = await storage.model('Transaction').create(req.body);
    return res.status(200).json(transaction._filter());
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new transfer transaction
 */
router.post('/transfer', async (req, res) => {
  try {
    const transactions = await storage.model('Transaction').createTransferTransaction(req.body);
    const filteredTransactions = transactions.map(t => t._filter());
    return res.status(200).json(filteredTransactions);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Refund a transaction
 */
router.put('/refund', async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) { return res.status(400).json({ error: 'transactionId required' }); }

    const transactions = await storage.model('Transaction').findTransactions({ transactionId });
    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const transaction = transactions[0];
    const result = await transaction.createRefundTransaction();
    return res.status(200).json(result._filter());
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Cancel a pending transaction
 */
router.delete('/cancel', async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!transactionId) { return res.status(400).json({ error: 'transactionId required' }); }

    const transactions = await storage.model('Transaction').findTransactions({ transactionId });
    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const transaction = transactions[0];
    const result = await transaction.cancel();
    return res.status(200).json(result._filter());
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a transaction by id
 */
router.get('/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    if (!transactionId) { return res.status(400).json({ error: 'transactionId required' }); }

    const transactions = await storage.model('Transaction').findTransactions({ transactionId });
    
    const filteredTransaction = transactions[0]?._filter();
    return res.status(200).json(filteredTransaction || {});
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all transactions matching query
 */
router.get('/', async (req, res) => {
  try {
    const transactions = await storage.model('Transaction').findTransactions(req.query);
    const filteredTransactions = transactions.map(t => t._filter());
    return res.status(200).json(filteredTransactions);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/transactions' };
