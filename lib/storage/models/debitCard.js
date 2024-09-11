import crypto from 'crypto';
import storage from '../index.js';
import Helpers from '../../util/helpers.js';
import HandledError from '../../util/handledError.js';
import logger from '../../util/logger.js';
import { auditSave } from '../plugins.js';

// Define the schema for a debit card
const DebitCard = new storage.schema({
  accountNumber: { type: String, required: true, unique: true },
  lastFourDigits: { type: String, validate: { validator: d => /^\d{4}$/.test(d), message: 'Invalid last four digits' }, required: true },
  active: { type: Boolean, default: true },
  lastOverdraftFee: { type: Date },
  _user: { type: storage.schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  auditLog: [{ timestamp: Date, performedBy: String, action: String }],
},
{ timestamps: true });

// Plugin auditSave for auditLog field
DebitCard.plugin(auditSave);

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a debit card for a user
 * @param {Object} params - Parameters for the debit card
 * @param {String} params.userId - The user ID for the debit card
 * 
 * @returns {DebitCard} debitCard - New debit card object
 */
DebitCard.statics.create = async function({ userId } = {}) {
  try {
    // Validate and set the debit card parameters
    if (!Helpers.isValidObjectId(userId)) { throw new HandledError('valid userId is required', 400); }
    const existingDebitCard = await storage.model('DebitCard').findOne({ _user: userId });
    if (existingDebitCard) { throw new HandledError('Debit card already exists for user', 400); }
    const user = await storage.model('User').findById({ _id: userId });
    if (!user) { throw new HandledError('User not found to create debit card', 400); }

    const accountNumber = generateAccountNumber();
    const debitCard = new storage.model('DebitCard')({ accountNumber, lastFourDigits: accountNumber.slice(-4), _user: userId });
    await debitCard.save();

    return debitCard;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating debit card: ${err.message}`, { userId });
      throw err;
    }
    logger.error('Error creating debit card', err, { userId });
    throw new HandledError('Error creating debit card', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------
  
/**
 * Method to get the transactions for a debit card
 * 
 * @returns {Array<Transaction>} results - Array of transactions for the debit card
 */
DebitCard.methods.findTransactions = async function() {
  try {
    const results = await storage.model('Transaction').findTransactions({ debitCardId: this._id });
    return results;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error finding transactions for debit card: ${err.message}`, { debitCardId: this._id });
      throw err;
    }
    logger.error('Error finding debit card transactions', err, { debitCardId: this._id });
    throw new HandledError('Error finding debit card transactions', 500);
  }
};

/**
 * Method to get the balances for a debit card
 * 
 * @returns {Object} - Object with current, pending, and final balances
 */
DebitCard.methods.getBalances = async function() {
  try {
    const totals = await storage.model('Transaction').aggregate([
      { $match: { _debitCard: this._id } },
      {
        $group: {
          _id: null,
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } }
        }
      },
      { $project: { _id: 0, completed: 1, pending: 1 } }
    ]).exec();
    return { currentBalance: totals[0].completed, pendingBalance: totals[0].pending, finalBalance: totals[0].completed + totals[0].pending };
  } catch (err) {
    logger.error('Error getting debit card balances', err, { debitCardId: this._id });
    throw new HandledError('Error getting debit card balances', 500);
  }
};

/**
 * Method to set a debit card as active
 * 
 * @returns {DebitCard} - Updated debit card object
 */
DebitCard.methods.setActive = async function() {
  try {
    if (this.active) { return this; }
    this.active = true;

    await this.auditSave({ performedBy: 'user', action: 'setActive' });
    return this;
  } catch (err) {
    logger.error('Error setting debit card as active', err, { debitCardId: this._id });
    throw new HandledError('Error setting debit card as active', 500);
  }
};

/**
 * Method to set a debit card as inactive
 * 
 * @returns {DebitCard} - Updated debit card object
 */
DebitCard.methods.setInactive = async function() {
  try {
    if (!this.active) { return this; }
    this.active = false;

    await this.auditSave({ performedBy: 'user', action: 'setInactive' });
    return this;
  } catch (err) {
    logger.error('Error setting debit card as inactive', err, { debitCardId: this._id });
    throw new HandledError('Error setting debit card as inactive', 500);
  }
};

/**
 * Filter method to be used before returning to the client
 * 
 * @returns {Object} - Filtered debitCard object
 */
DebitCard.methods._filter = function() {
  return {
    id: this._id,
    accountNumber: this.accountNumber,
    lastFourDigits: this.lastFourDigits,
    active: this.active,
    user: this._user,
    auditLog: this.auditLog?.map(log => {
      return { timestamp: log.timestamp, performedBy: log.performedBy, action: log.action };
    }),
  };
}

// ------------------------- HELPER FUNCTIONS -------------------------

/**
 * Method to generate a random 16 digit account number
 * 
 * @returns {String} - 16 digit account number
 */
function generateAccountNumber() {
  // Generate 6 random bytes (64 bits) and convert to a big-endian integer
  const randomBytes = crypto.randomBytes(6);
  const randomNumber = randomBytes.readUIntBE(0, 6);

  // Ensure the number is 16 digits long by padding
  return randomNumber.toString().padStart(16, '0').slice(0, 16);
}

export default storage.model('DebitCard', DebitCard);