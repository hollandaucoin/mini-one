import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import Helpers from '../../util/helpers.js';
import logger from '../../util/logger.js';

// Defined enum constants to use in schema and validation in methods
const TRANSACTION_TYPES = ['debit', 'withdrawal'];
const TRANSACTION_DEBIT_SUBTYPES = ['credit', 'refund', 'interest', 'cashback'];
const TRANSACTION_WITHDRAWAL_SUBTYPES = ['purchase', 'fee', 'transfer'];
const TRANSACTION_STATUSES = ['pending', 'completed', 'failed', 'canceled'];
// Other transaction related constants
const CASHBACK_VENDERS = ['WLMRT', 'AMZN', 'APPL'];
const CASHBACK_RATE = process.env.CASHBACK_RATE || 0.01;
const INTEREST_RATE = process.env.INTEREST_RATE || 0.01;
const MAX_NEGATIVE_BALANCE = process.env.MAX_NEGATIVE_BALANCE || -100;
const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

// Schema for a transaction
const Transaction = new storage.schema({
  date: { type: Date, required: true },
  type: { type: String, enum: TRANSACTION_TYPES, required: true },
  subtype: { type: String, enum: TRANSACTION_DEBIT_SUBTYPES.concat(TRANSACTION_WITHDRAWAL_SUBTYPES), required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: TRANSACTION_STATUSES, default: 'pending', required: true },
  vender: { type: String, required: true },
  description: String,
  _debitCard: { type: storage.schema.Types.ObjectId, ref: 'DebitCard', required: true },
  _user: { type: storage.schema.Types.ObjectId, ref: 'User', required: true }
},
{ timestamps: true });

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a new transaction
 * @param {Object} params - Parameters for the transaction
 * @param {String} params.type - Type of transaction (see TRANSACTION_TYPES)
 * @param {String} params.subtype - Subtype of transaction (see TRANSACTION_SUBTYPES)
 * @param {Number} params.amount - Amount of the transaction
 * @param {String} params.vender - Vender of the transaction (determines cashback eligibility)
 * @param {String} params.description - Description of the transaction
 * @param {String} params.accountNumber - Account number of the debit card to associate with the transaction
 * 
 * @returns {Transaction} transaction - New transaction object
 */
Transaction.statics.create = async function({ type, subtype, amount, vender, description, accountNumber, debitCard, skipSave = false } = {}) {
  try {
    // Validate the transaction parameters - ensuring valid subtype and amount based on type
    if (!TRANSACTION_TYPES.includes(type)) { throw new HandledError('Valid transaction type required', 400); }
    if (type === 'debit') {
      if (!TRANSACTION_DEBIT_SUBTYPES.includes(subtype)) { throw new HandledError('Valid debit transaction subtype required', 400); }
      if (typeof amount !== 'number' || amount <= 0 || Math.round(amount * 100) / 100 !== amount) {
        throw new HandledError('Debit transaction amount required as a positive number with no more than 2 decimal places', 400);
      }
    } else {
      if (!TRANSACTION_WITHDRAWAL_SUBTYPES.includes(subtype)) { throw new HandledError('Valid withdrawal transaction subtype required', 400); }
      if (typeof amount !== 'number' || amount >= 0 || Math.round(amount * 100) / 100 !== amount) {
        throw new HandledError('Withdrawal transaction amount required as a negative number with no more than 2 decimal places', 400);
      }
    }
    if (typeof vender !== 'string') { throw new HandledError('Vender required as a string', 400); }
    if (typeof description !== 'undefined' && typeof description !== 'string') { throw new HandledError('Transaction description must be a string', 400); }
    if (!(debitCard instanceof storage.model('DebitCard'))) {
      if (Helpers.isValidObjectId(debitCard)) {
        debitCard = await storage.model('DebitCard').findOne({ _id: debitCard });
      } else {
        if (typeof accountNumber !== 'string') { throw new HandledError('Account number required as a string if valid debitCard or id is not provided', 400); }
        debitCard = await storage.model('DebitCard').findOne({ accountNumber });
      }
    }
    // Ensure the debit card exists based on passed in, or was found with id or accountNumber, and its also active
    if (!debitCard || !debitCard.active) { throw new HandledError('Debit card not found or inactive for the account number provided', 400); }

    const transaction = new storage.model('Transaction')({ date: new Date(), type, subtype, amount, vender, description, _debitCard: debitCard._id, _user: debitCard._user });
    if (!skipSave) { await transaction.save(); }

    return transaction;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating transaction: ${err.message}`);
      throw err;
    }
    logger.error('Error creating transaction', err);
    throw new HandledError('Error creating transaction', 500);
  }
};

/**
 * Method to create a transfer transaction between two accounts
 * @param {Object} params - Parameters for the transaction
 * @param {String} params.senderAccountNumber - Account number of the sender
 * @param {String} params.receiverAccountNumber - Account number of the receiver
 * @param {Number} params.amount - Amount to transfer
 * 
 * @returns {Array<Transaction>} - Array containing the sender and receiver transactions
 */
Transaction.statics.createTransferTransaction = async function({ senderAccountNumber, receiverAccountNumber, amount } = {}) {
  try {
    // Validate parameters for the transfer
    if (typeof senderAccountNumber !== 'string') { throw new HandledError('Valid senderAccountNumber required as a string', 400); }
    if (typeof receiverAccountNumber !== 'string') { throw new HandledError('Valid receiverAccountNumber required as a string', 400); }
    if (typeof amount !== 'number' || amount <= 0) { throw new HandledError('Transfer amount required as a positive number', 400); }

    // Validate the sender
    const senderDebitCard = await storage.model('DebitCard').findOne({ accountNumber: senderAccountNumber });
    if (!senderDebitCard || !senderDebitCard.active) { throw new HandledError('Sender debit card not found or is inactive', 400); }
    // Validate the receiver
    const receiverDebitCard = await storage.model('DebitCard').findOne({ accountNumber: receiverAccountNumber });
    if (!receiverDebitCard || !receiverDebitCard.active) { throw new HandledError('Receiver debit card not found or is inactive', 400); }

    // Verify the user sending the transfer has enough funds
    const senderBalance = await senderDebitCard.getBalances();
    if (senderBalance.finalBalance < amount) { throw new HandledError('Insufficient funds for transfer', 400); }

    // Create the withdrawal transaction for the sender
    const senderTransaction = await storage.model('Transaction').create({
      date: new Date(),
      type: 'withdrawal',
      subtype: 'transfer',
      amount: -amount,
      vender: 'SELF',
      description: `Transfer to ${receiverDebitCard._user.toString()}`,
      debitCard: senderDebitCard
    });
    // Create a deposit transaction for the receiver
    const receiverTransaction = await storage.model('Transaction').create({
      date: new Date(),
      type: 'debit',
      subtype: 'credit',
      amount,
      vender: 'SELF',
      description: `Transfer from ${senderDebitCard._user.toString()}`,
      debitCard: receiverDebitCard
    });

    return [senderTransaction, receiverTransaction];
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating transfer transaction: ${err.message}`);
      throw err;
    }
    logger.error('Error creating transfer transaction', err);
    throw new HandledError('Error creating transfer transactions', 500);
  }
};

/**
 * Wrapper method to create an overdraft fee transaction for a given debit card
 * @param {Object} params - Parameters for the transaction
 * @param {DebitCard} params.debitCard - Debit Card to create overdraft fee for
 * 
 * @returns {Transaction} transaction - New transaction object
 */
Transaction.statics.createOverdraftFeeTransaction = async function({ debitCard } = {}) {
  try {
    if (!debitCard || !debitCard._id || !debitCard._user) {
      throw new HandledError('Invalid transaction parameters for overdraft fee', 400);
    }
    const feeTransaction = await storage.model('Transaction').create({
      date: new Date(),
      type: 'withdrawal',
      subtype: 'fee',
      amount: -10,
      vender: 'ONE',
      description: 'Overdraft fee',
      debitCard,
      skipSave: true
    });
    // Set status to completed for instant fee
    feeTransaction.status = 'completed';
    await feeTransaction.save();

    debitCard.lastOverdraftFee = new Date();
    await debitCard.save();

    return feeTransaction;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating overdraft fee transaction: ${err.message}`, { debitCardId: debitCard?._id });
      throw err;
    }
    logger.error('Error creating overdraft fee transaction', err, { debitCardId: debitCard?._id });
    throw new HandledError('Error creating overdraft fee transaction', 500);
  }
};

/**
 * Wrapper method to create a cashback transaction for a given transaction
 * 
 * @returns {Transaction} transaction - New transaction object
 */
Transaction.statics.createCashbackTransaction = async function({ transaction } = {}) {
  try {
    if (!transaction || !transaction.amount || !transaction._debitCard || !transaction._user) {
      throw new HandledError('Invalid transaction parameters for cashback', 400);
    }
    if (transaction.status !== 'completed' || transaction.type !== 'withdrawal' || transaction.subtype !== 'purchase') {
      throw new HandledError('Transaction invalid for cashback - must be completed purchase', 400);
    }
    const cashbackTransaction = await storage.model('Transaction').create({
      date: new Date(),
      type: 'debit',
      subtype: 'cashback',
      amount: Math.round((Math.abs(transaction.amount) * CASHBACK_RATE) * 100) / 100,
      vender: 'ONE',
      description: `Cashback for eligible purchase - ${transaction._id.toString()}`,
      debitCard: transaction._debitCard,
      skipSave: true
    });
    // Set status to completed for instant cashback
    cashbackTransaction.status = 'completed';
    await cashbackTransaction.save();

    return cashbackTransaction;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating cashback transaction: ${err.message}`, { transactionId: transaction?._id });
      throw err;
    }
    logger.error('Error creating cashback transaction', err, { transactionId: transaction?._id });
    throw new HandledError('Error creating cashback transaction', 500);
  }
};

/**
 * Method to find transactions based on parameters
 * @param {Object} params - Parameters to find transactions by
 * @param {String} params.id - ID of the transaction to find
 * @param {Date} params.startDate - Start date of the transactions to find
 * @param {Date} params.endDate - End date of the transactions to find
 * @param {String} params.type - Type of transaction to find
 * @param {String} params.subtype - Subtype of transaction to find
 * @param {String} params.status - Status of the transaction to find
 * @param {String} params.vender - Vender of the transaction to find
 * @param {String} params.accountNumber - Account number of the debit card to find transactions for
 * @param {String} params.email - Email of the user to find transactions for 
 * 
 * @returns {Array<Transaction>} - Array of transactions found
 */
Transaction.statics.findTransactions = async function({ transactionId, startDate, endDate, type, subtype, status, vender, debitCardId, accountNumber, email } = {}) {
  const query = {};
  try {
    // If an ID is provided, return the transaction with that ID
    if (transactionId) {
      if (!Helpers.isValidObjectId(transactionId)) { throw new HandledError('id parameter invalid', 400); }
      const transaction = await storage.model('Transaction').findOne({ _id: transactionId });
      return transaction ? [transaction] : [];
    }
    // Otherwise, build the query based on the provided parameters
    if (startDate) {
      if (!Helpers.isValidDate(startDate)) { throw new HandledError('startDate paramter invalid', 400); }
      query._id = { $gte: Helpers.getObjectIdFromDate(new Date(startDate)) };
    }
    if (endDate) {
      if (!Helpers.isValidDate(endDate)) { throw new HandledError('endDate paramter invalid', 400); }
      query._id = { ...query._id, $lte: Helpers.getObjectIdFromDate(new Date(endDate)) };
    }
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) { throw new HandledError('startDate must be before endDate', 400); }
    if (debitCardId && accountNumber) { throw new HandledError('cannot provide both debitCardId and accountNumber', 400); }
    if (debitCardId) {
      if (!Helpers.isValidObjectId(debitCardId)) { throw new HandledError('debitCardId parameter invalid', 400); }
      query._debitCard = debitCardId;
    }
    if (accountNumber) {
      const debitCard = await storage.model('DebitCard').findOne({ accountNumber });
      query._debitCard = debitCard?._id;
    }
    if (email) {
      const user = await storage.model('User').findOne({ email });
      query._user = user?._id;
    }
    if (type) { query.type = type; }
    if (subtype) { query.subtype = subtype; }
    if (status) { query.status = status; }
    if (vender) { query.vender = vender; }

    const transactions = storage.model('Transaction').find(query).cursor();

    const results = [];
    for (let tx = await transactions.next(); tx != null; tx = await transactions.next()) {
      results.push(tx);
    }
    return results;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error finding transactions: ${err.message}`);
      throw err;
    }
    logger.error('Error finding transactions', err);
    throw new HandledError('Error finding transactions', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Wrapper method to create a refund transaction for a given transaction
 * 
 * @returns {Transaction} transaction - New transaction object
 */
Transaction.methods.createRefundTransaction = async function() {
  try {
    if (!this.amount || !this.vender || !this._debitCard || !this._user) {
      throw new HandledError('Invalid transaction parameters for refund', 400);
    }
    if (this.status !== 'completed' || this.type !== 'withdrawal' || this.subtype !== 'purchase') {
      throw new HandledError('Transaction invalid for refund - must be completed purchase', 400);
    }
    const refundTransaction = await storage.model('Transaction').create({
      date: new Date(),
      type: 'debit',
      subtype: 'refund',
      amount: Math.abs(this.amount),
      vender: this.vender,
      description: `Refund for ${this._id.toString()}`,
      debitCard: this._debitCard
    });

    return refundTransaction;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error creating refund transaction: ${err.message}`, { transactionId: this._id });
      throw err;
    }
    logger.error('Error creating transaction', err, { transactionId: this._id });
    throw new HandledError('Error creating refund transaction', 500);
  }
};

/**
 * Method to cancel a pending transaction
 * 
 * @returns {Transaction} transaction - Updated transaction object
 */
Transaction.methods.cancel = async function() {
  try {
    if (this.status !== 'pending') { throw new HandledError('Transaction cannot be canceled once executed', 400); }
    this.status = 'canceled';
    await this.save();
    return this;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error canceling transaction: ${err.message}`, { transactionId: this._id });
      throw err;
    }
    logger.error('Error canceling transaction', err, { transactionId: this._id });
    throw new HandledError('Error canceling transaction', 500);
  }
};

/**
 * Filter method to be used before returning to the client
 * 
 * @returns {Object} filteredTransaction - Filtered transaction object
 */
Transaction.methods._filter = function() {
  return {
    id: this._id,
    date: this.date.toISOString(),
    type: this.type,
    subtype: this.subtype,
    amount: this.amount,
    status: this.status,
    description: this.description,
    debitCard: this._debitCard,
    user: this._user,
  };
}

// ------------------------- OPERATION METHODS USED BY SCHEDULED TASKS -------------------------

/**
 * Validate and handle all pending transactions, grouped by debitCard to handle by balance
 * Cashback and overdraft fee transactions are created as needed
 * 
 * Note: ran via scheduled task
 */
Transaction.statics.validatePending = async function() {
  try {
    // If there are no pending transactions, return early
    const pendingTransactions = await storage.model('Transaction').find({ status: 'pending' }).countDocuments();
    if (pendingTransactions === 0) { return; }

    // Aggregate pending transactions and group by _debitCard
    const transactionsByCard = await storage.model('Transaction').aggregate([
      { $match: { status: 'pending' } },
      { $sort: { date: 1 } },
      { $group: { _id: '$_debitCard', transactions: { $push: '$$ROOT' } } }
    ]);

    // Validate each user's transactions
    for (const transactionGroup of transactionsByCard) {
      const debitCard = await storage.model('DebitCard').findOne({ _id: transactionGroup._id });

      let debitBalance = {};
      try {
        debitBalance = await debitCard.getBalances();
      } catch (err) {
        logger.error('Error getting balances for debit card during validation', err, { debitCardId: debitCard._id });
        // Swallow the error and continue to the next transaction
        continue;
      }
      // Iterate through each transaction and update status based on debitBalance
      for (const transaction of transactionGroup.transactions) {
        try {
          // If its a withdrawal, handle based on balance
          if (transaction.type === 'withdrawal') {
            // If the balance will be below the max negative balance, fail the transaction - otherwise complete
            if (debitBalance.currentbalance + transaction.amount < MAX_NEGATIVE_BALANCE) {
              transaction.status = 'failed';
            } else {
              transaction.status = 'completed';
              debitBalance.currentBalance += transaction.amount;

              // If cashback vender, create a cashback transaction
              if (CASHBACK_VENDERS.includes(transaction.vender.toUpperCase())) {
                await storage.model('Transaction').createCashbackTransaction({ transaction });
              }
            }
          } else {
            transaction.status = 'completed';
            debitBalance.currentBalance += transaction.amount;
          }
          // Save the updated transaction
          await storage.model('Transaction').updateOne({ _id: transaction._id }, { $set: { status: transaction.status } });
        } catch (err) {
          logger.error('Error validating transaction', err, { transactionId: transaction._id });
          // Swallow the error and continue to the next transaction
        }
      }
      try {
        // If the balance on the debit card is negative, and they havent been charged in 5 days, charge an overdraft fee
        if (debitBalance.currentBalance < 0 && debitCard.lastOverdraftFee && new Date() - debitCard.lastOverdraftFee > FIVE_DAYS) {
          await storage.model('Transaction').createOverdraftFeeTransaction({ debitCard });
        }
      } catch (err) {
        logger.error('Error creating overdraft fee after validation', err, { debitCardId: debitCard._id });
        // Swallow the error and continue to the next debit card
      }
    }
  } catch (err) {
    logger.error('Error validating pending transactions', err);
    throw new HandledError('Error validating pending transactions', 500);
  }
};

/**
 * Add interest transaction to each users account
 * 
 * Note: ran via scheduled task
 */
Transaction.statics.addBalanceInterest = async () => {
  try {
    // Aggregate transactions and calculate balances for completed transactions by user, filtering for only those over 0
    const transactionStream = storage.model('Transaction').aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$_user', totalBalance: { $sum: '$amount' }, _debitCard: { $first: '$_debitCard' } } },
      { $match: { totalBalance: { $gt: 0 } } }
    ]).cursor();

    // Create an interest transaction for each user with a balance
    const transactions = [];
    transactionStream
      .on('data', async (transactionInfo) => {
        transactions.push({
          date: new Date(),
          type: 'debit',
          subtype: 'interest',
          amount: Math.round(transactionInfo.totalBalance * INTEREST_RATE * 100) / 100,
          status: 'completed',
          vender: 'ONE',
          description: 'Interest added to account',
          _user: transactionInfo._id,
          _debitCard: transactionInfo._debitCard
        });
      })
      .on('end', async () => {
        if (transactions.length) {
          await storage.model('Transaction').insertMany(transactions, { ordered: false });
        }
      })
      .on('error', (err) => {
        throw err;
      });
  } catch (err) {
    logger.error('Error adding balance interest', err);
    throw new HandledError('Error adding balance interest', 500);
  }
};

export default storage.model('Transaction', Transaction);
