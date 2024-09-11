import express from 'express';
import storage from '../storage/index.js';

const router = express.Router();

/**
 * Create a new user
 */
router.post('/', async (req, res) => {
  try {
    const user = await storage.model('User').create(req.body);
    return res.status(200).json(user._filter());
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a user by id
 */
router.put('/update', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) { return res.status(400).json({ error: 'userId required' }); }

    const user = await storage.model('User').findUser({ userId });
    if (!user) { return res.status(400).json({ error: 'User not found' }); }

    const updatedUser = await user.update(req.body);
    const filteredUser = updatedUser._filter();
    return res.status(200).json(filteredUser);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a user by id
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) { return res.status(400).json({ error: 'userId required' }); }

    const user = await storage.model('User').findUser({ userId });
    if (!user) { return res.status(400).json({ error: 'User not found' }); }

    const filteredUser = user._filter();
    return res.status(200).json(filteredUser);
  } catch (err) {
    if (err.handled) {
      return res.status(err.code).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default { router, path: '/users' };
