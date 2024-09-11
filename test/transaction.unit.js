import sinon from 'sinon';
import * as chai from 'chai';
import storage from '../lib/storage/index.js';
import Helpers from '../lib/util/helpers.js';

const should = chai.should();

describe('Transaction', () => {
  const user = new storage.model('User')({ firstName: 'Test', lastName: 'User', email: 'test@gmail.com' });
  const user2 = new storage.model('User')({ firstName: 'Test2', lastName: 'User2', email: 'test2@gmail.com' });
  const debitCard = new storage.model('DebitCard')({ accountNumber: '123456789', lastFourDigits: '1234', active: true, _user: user._id });
  const debitCard2 = new storage.model('DebitCard')({ accountNumber: '987654321', lastFourDigits: '4321', active: true, _user: user2._id });
  const transaction = new storage.model('Transaction')({
    _id: Helpers.getObjectIdFromDate('2024-09-01'), date: new Date('2024-09-01'), type: 'debit', subtype: 'credit', amount: 100, vender: 'test', description: 'test tx', _debitCard: debitCard._id, _user: debitCard._user
  });
  const transaction2 = new storage.model('Transaction')({
    _id: Helpers.getObjectIdFromDate('2024-09-02'), date: new Date('2024-09-02'), type: 'withdrawal', subtype: 'purchase', amount: -20, vender: 'test2', description: 'test tx2', _debitCard: debitCard2._id, _user: debitCard2._user
  });
  const transaction3 = new storage.model('Transaction')({
    _id: Helpers.getObjectIdFromDate('2024-09-03'), date: new Date('2024-09-03'), type: 'withdrawal', subtype: 'fee', amount: -10, vender: 'test3', description: 'test tx3', _debitCard: debitCard._id, _user: debitCard._user
  });

  let saveStub;
  beforeEach(async () => {
    saveStub = sinon.stub(storage.model('Transaction').prototype, 'save');
  });

  describe('create', async () => {
    let debitCardStub;

    beforeEach(async () => {
      debitCardStub = sinon.stub(storage.model('DebitCard'), 'findOne');
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to invalid transaction type', async () => {
      try {
        await storage.model('Transaction').create();
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Valid transaction type required');
      }
    });
    it('should error due to invalid subtype for a debit transction', async () => {
      try {
        await storage.model('Transaction').create({ type: 'debit' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Valid debit transaction subtype required');
      }
    });
    it('should error due to invalid amount for a debit transction', async () => {
      try {
        await storage.model('Transaction').create({ type: 'debit', subtype: 'cashback', amount: 99.999999 });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Debit transaction amount required as a positive number with no more than 2 decimal places');
      }
    });
    it('should error due to invalid subtype for a withdrawal transction', async () => {
      try {
        await storage.model('Transaction').create({ type: 'withdrawal' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Valid withdrawal transaction subtype required');
      }
    });
    it('should error due to invalid amount for a withdrawal transction', async () => {
      try {
        await storage.model('Transaction').create({ type: 'withdrawal', subtype: 'purchase' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Withdrawal transaction amount required as a negative number with no more than 2 decimal places');
      }
    });
    it('should error due to invalid vender', async () => {
      try {
        await storage.model('Transaction').create({ type: 'withdrawal', subtype: 'purchase', amount: -100, vender: 123 });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Vender required as a string');
      }
    });
    it('should error due to invalid description', async () => {
      try {
        await storage.model('Transaction').create({ type: 'withdrawal', subtype: 'purchase', amount: -100, vender: 'TEST', description: false });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Transaction description must be a string');
      }
    });
    it('should error due to invalid account number', async () => {
      try {
        await storage.model('Transaction').create({ type: 'withdrawal', subtype: 'purchase', amount: -100, vender: 'TEST', accountNumber: 123 });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Account number required as a string if valid debitCard or id is not provided');
      }
    });
    it('should error due to no debit card found', async () => {
      try {
        debitCardStub.returns(null);
        await storage.model('Transaction').create({ type: 'withdrawal', subtype: 'purchase', amount: -100, vender: 'TEST', accountNumber: debitCard.accountNumber, email: user.email });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Debit card not found or inactive for the account number provided');
      }
    });
    it('should error successfully create a transaction', async () => {
      try {
        debitCardStub.returns(debitCard);
        const transaction = await storage.model('Transaction').create({ type: 'withdrawal', subtype: 'purchase', amount: -100, vender: 'TEST', accountNumber: debitCard.accountNumber, email: user.email });
        saveStub.callCount.should.equal(1);
        (transaction instanceof storage.model('Transaction')).should.equal(true);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('createTransferTransaction', async () => {
    let debitCardStub;
    let balanceStub;
    
    beforeEach(async () => {
      debitCardStub = sinon.stub(storage.model('DebitCard'), 'findOne');
      balanceStub = sinon.stub(debitCard, 'getBalances');
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to invalid senderAccountNumber', async () => {
      try {
        await storage.model('Transaction').createTransferTransaction({ senderAccountNumber: false });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Valid senderAccountNumber required as a string');
      }
    });
    it('should error due to invalid receiverAccountNumber', async () => {
      try {
        await storage.model('Transaction').createTransferTransaction({ senderAccountNumber: debitCard.accountNumber, receiverAccountNumber: false });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Valid receiverAccountNumber required as a string');
      }
    });
    it('should error due to invalid amount', async () => {
      try {
        await storage.model('Transaction').createTransferTransaction({ senderAccountNumber: debitCard.accountNumber, receiverAccountNumber: debitCard2.accountNumber });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Transfer amount required as a positive number');
      }
    });
    it('should error due to invalid sender debit card', async () => {
      try {
        debitCardStub.resolves(null);
        await storage.model('Transaction').createTransferTransaction({ senderAccountNumber: 'invalid', receiverAccountNumber: debitCard2.accountNumber, amount: 20 });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Sender debit card not found or is inactive');
      }
    });
    it('should error due to invalid receiver debit card', async () => {
      try {
        debitCardStub.onFirstCall().resolves(debitCard);
        debitCardStub.onSecondCall().resolves(null);
        await storage.model('Transaction').createTransferTransaction({ senderAccountNumber: debitCard.accountNumber, receiverAccountNumber: 'invalid', amount: 20 });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Receiver debit card not found or is inactive');
      }
    });
    it('should error due to insufficient funds in the sender account', async () => {
      try {
        debitCardStub.onFirstCall().resolves(debitCard);
        debitCardStub.onSecondCall().resolves(debitCard2);
        balanceStub.resolves({ currentBalance: 0, pendingBalance: 0, finalBalance: 0 });
        await storage.model('Transaction').createTransferTransaction({ senderAccountNumber: debitCard.accountNumber, receiverAccountNumber: debitCard2.accountNumber, amount: 20 });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Insufficient funds for transfer');
      }
    });
    it('should successfully create the transfer transactions', async () => {
      try {
        debitCardStub.onFirstCall().resolves(debitCard);
        debitCardStub.onSecondCall().resolves(debitCard2);
        balanceStub.resolves({ currentBalance: 100, pendingBalance: 0, finalBalance: 100 });
        const results = await storage.model('Transaction').createTransferTransaction({ senderAccountNumber: debitCard.accountNumber, receiverAccountNumber: debitCard2.accountNumber, amount: 20 });
        saveStub.callCount.should.equal(2);
        (results[0] instanceof storage.model('Transaction')).should.equal(true);
        (results[1] instanceof storage.model('Transaction')).should.equal(true);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('createOverdraftFeeTransaction', async () => {
    beforeEach(async () => {
      sinon.stub(storage.model('DebitCard').prototype, 'save');
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to invalid parameters', async () => {
      try {
        await storage.model('Transaction').createOverdraftFeeTransaction();
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Invalid transaction parameters for overdraft fee');
      }
    });
    it('should succesfully create an overdraft fee transaction and set to complete', async () => {
      try {
        const feeTransaction = await storage.model('Transaction').createOverdraftFeeTransaction({ debitCard });
        saveStub.callCount.should.equal(1);
        feeTransaction.status.should.equal('completed');
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('createCashbackTransaction', async () => {
    beforeEach(async () => {
      sinon.stub(storage.model('DebitCard'), 'findOne').returns(debitCard);
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to invalid parameters', async () => {
      try {
        const tempTransaction = new storage.model('Transaction')(transaction2.toObject());
        tempTransaction.amount = undefined;
        await storage.model('Transaction').createCashbackTransaction({ transaction: tempTransaction });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Invalid transaction parameters for cashback');
      }
    });
    it('should error due to transaction invalid status/type to be refunded', async () => {
      try {
        await storage.model('Transaction').createCashbackTransaction({ transaction: transaction2 }); // Pending
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Transaction invalid for cashback - must be completed purchase');
      }
    });
    it('should successfully create a cashback transaction', async () => {
      try {
        const tempTransaction = new storage.model('Transaction')(transaction2.toObject());
        tempTransaction.status = 'completed';
        const result = await storage.model('Transaction').createCashbackTransaction({ transaction: tempTransaction });
        saveStub.callCount.should.equal(1);
        (result instanceof storage.model('Transaction')).should.equal(true);
        result.type.should.equal('debit');
        result.subtype.should.equal('cashback');
        result.amount.should.equal(Math.round((Math.abs(tempTransaction.amount) * 0.01) * 100) / 100);
        result.description.should.equal(`Cashback for eligible purchase - ${tempTransaction._id.toString()}`);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('findTransactions', async () => {
    let transactionFindOneStub;
    let cursorStub;
    let transactionFindStub;
    beforeEach(async () => {
      transactionFindOneStub = sinon.stub(storage.model('Transaction'), 'findOne');
      cursorStub = { next: sinon.stub(), close: sinon.stub().resolves() };
      transactionFindStub = sinon.stub(storage.model('Transaction'), 'find').returns({ cursor: () => cursorStub });
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to invalid id being passed', async () => {
      try {
        await storage.model('Transaction').findTransactions({ transactionId: '123' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('id parameter invalid');
      }
    });
    it('should return an empty array due to id passed not finding transaction', async () => {
      try {
        transactionFindOneStub.resolves();
        const results = await storage.model('Transaction').findTransactions({ transactionId: transaction._id.toString() });
        results.should.deep.equal([]);
      } catch (err) {
        should.not.exist(err);
      }
    });
    it('should return an array containing the transaction associated to the id passed', async () => {
      try {
        transactionFindOneStub.resolves(transaction);
        const results = await storage.model('Transaction').findTransactions({ transactionId: transaction._id.toString() });
        results.should.deep.equal([transaction]);
      } catch (err) {
        should.not.exist(err);
      }
    });
    it('should error due to invalid startDate passed', async () => {
      try {
        await storage.model('Transaction').findTransactions({ startDate: 'invalid' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('startDate paramter invalid');
      }
    });
    it('should error due to invalid endDate passed', async () => {
      try {
        await storage.model('Transaction').findTransactions({ endDate: 'invalid' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('endDate paramter invalid');
      }
    });
    it('should error due to startDate being after endDate', async () => {
      try {
        await storage.model('Transaction').findTransactions({ startDate: '2024-09-02', endDate: '2024-09-01' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('startDate must be before endDate');
      }
    });
    it('should return an array of transactions in the date range provided', async () => {
      try {
        cursorStub.next.onCall(0).resolves(transaction);
        cursorStub.next.onCall(1).resolves(transaction2);
        cursorStub.next.onCall(2).resolves(transaction3);
        cursorStub.next.onCall(3).resolves(null);

        const results = await storage.model('Transaction').findTransactions({ startDate: '2024-09-01', endDate: '2024-09-03' });
        transactionFindStub.callCount.should.equal(1);
        results.should.deep.equal([transaction, transaction2, transaction3]);
      } catch (err) {
        should.not.exist(err);
      }
    });
    it('should error due to both debitCardId and accountNumber being provided', async () => {
      try {
        await storage.model('Transaction').findTransactions({ debitCardId: debitCard._id, accountNumber: debitCard.accountNumber });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('cannot provide both debitCardId and accountNumber');
      }
    });
    it('should error due to an invalid debitCardId provided', async () => {
      try {
        await storage.model('Transaction').findTransactions({ debitCardId: 'invalid' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('debitCardId parameter invalid');
      }
    });
    it('should return an array of transactions associated to the debitCard for the account number provided', async () => {
      try {
        sinon.stub(storage.model('DebitCard'), 'findOne').resolves(debitCard);
        cursorStub.next.onCall(0).resolves(transaction);
        cursorStub.next.onCall(1).resolves(transaction3);
        cursorStub.next.onCall(3).resolves(null);

        const results = await storage.model('Transaction').findTransactions({ accountNumber: debitCard.accountNumber });
        transactionFindStub.callCount.should.equal(1);
        results.should.deep.equal([transaction, transaction3]);
      } catch (err) {
        should.not.exist(err);
      }
    });
    it('should return an array of transactions associated to the user for the email provided', async () => {
      try {
        sinon.stub(storage.model('User'), 'findOne').resolves(user);
        cursorStub.next.onCall(0).resolves(transaction2);
        cursorStub.next.onCall(3).resolves(null);

        const results = await storage.model('Transaction').findTransactions({ email: user.email });
        transactionFindStub.callCount.should.equal(1);
        results.should.deep.equal([transaction2]);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('createRefundTransaction', async () => {
    beforeEach(async () => {
      sinon.stub(storage.model('DebitCard'), 'findOne').returns(debitCard);
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to invalid parameters', async () => {
      try {
        const tempTransaction = new storage.model('Transaction')(transaction2.toObject());
        tempTransaction.amount = undefined;
        await tempTransaction.createRefundTransaction();
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Invalid transaction parameters for refund');
      }
    });
    it('should error due to transaction invalid status/type to be refunded', async () => {
      try {
        await transaction2.createRefundTransaction(); // Pending
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Transaction invalid for refund - must be completed purchase');
      }
    });
    it('should successfully create a refund transaction', async () => {
      try {
        const tempTransaction = new storage.model('Transaction')(transaction2.toObject());
        tempTransaction.status = 'completed';
        const result = await tempTransaction.createRefundTransaction();
        saveStub.callCount.should.equal(1);
        (result instanceof storage.model('Transaction')).should.equal(true);
        result.type.should.equal('debit');
        result.subtype.should.equal('refund');
        result.amount.should.equal(Math.abs(tempTransaction.amount));
        result.description.should.equal(`Refund for ${tempTransaction._id.toString()}`);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('cancel', async () => {
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to transaction already executed', async () => {
      try {
        const tempTransaction = new storage.model('Transaction')(transaction2.toObject());
        tempTransaction.status = 'completed';
        await tempTransaction.cancel();
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Transaction cannot be canceled once executed');
      }
    });
    it('should properly cancel a pending transaction', async () => {
      try {
        const tempTransaction = new storage.model('Transaction')(transaction2.toObject());
        const result = await tempTransaction.cancel();
        saveStub.callCount.should.equal(1);
        result.status.should.equal('canceled');
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('_filter', async () => {
    afterEach(async () => {
      sinon.restore();
    });

    it('should not error', async () => {
      try {
        await transaction._filter();
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('validatePending', async () => {
    let findTransactionsStub;
    let aggregateStub;
    let findDebitStub;
    let getBalancesStub;
    let updateTransactionStub;
    beforeEach(async () => {
      findTransactionsStub = sinon.stub(storage.model('Transaction'), 'find');
      aggregateStub = sinon.stub(storage.model('Transaction'), 'aggregate');
      findDebitStub = sinon.stub(storage.model('DebitCard'), 'findOne');
      getBalancesStub = sinon.stub(debitCard, 'getBalances');
      updateTransactionStub = sinon.stub(storage.model('Transaction'), 'updateOne');
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should return early due to no pending transactions', async () => {
      try {
        findTransactionsStub.returns({ countDocuments: sinon.stub().resolves(0) });
        await storage.model('Transaction').validatePending();
        aggregateStub.callCount.should.equal(0);
      } catch (err) {
        should.not.exist(err);
      }
    });
    it('should validate pending transactions and update their status', async () => {
      try {
        findTransactionsStub.returns({ countDocuments: sinon.stub().resolves(2) });
  
        const mockTransactionsByCard = [{ _id: debitCard._id, transactions: [transaction.toObject(), transaction3.toObject()] }];
        aggregateStub.resolves(mockTransactionsByCard);
        findDebitStub.resolves({ _id: debitCard._id, getBalances: getBalancesStub });
        getBalancesStub.resolves({ currentBalance: 0 });
        updateTransactionStub.resolves();
    
        await storage.model('Transaction').validatePending();
        updateTransactionStub.callCount.should.equal(2);
        updateTransactionStub.firstCall.args[1].$set.status.should.equal('completed');
        updateTransactionStub.secondCall.args[1].$set.status.should.equal('completed');
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('addBalanceInterest', async () => {
    let aggregateStub;
    let insertManyStub;
  
    beforeEach(async () => {
      aggregateStub = sinon.stub(storage.model('Transaction'), 'aggregate');
      insertManyStub = sinon.stub(storage.model('Transaction'), 'insertMany');
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('shouldnt create any interest transactions due to no balances over 0 being found', async () => {
      try {
        const mockTransactionStream = {
          on: (event, callback) => {
            if (event === 'end') { callback(); }
            return mockTransactionStream;
          }
        };
    
        aggregateStub.returns({ cursor: () => mockTransactionStream });
        await storage.model('Transaction').addBalanceInterest();
        insertManyStub.callCount.should.equal(0);
      } catch (err) {
        should.not.exist(err);
      }
    });
    it('should create an interest transaction for each positive debit card balance found', async () => {
      try {
        const mockTransactionStream = {
          on: (event, callback) => {
            if (event === 'data') {
              callback({ _id: user._id, _debitCard: debitCard._id, totalBalance: 50 });
              callback({ _id: user2._id, _debitCard: debitCard2._id, totalBalance: 100 });
            }
            if (event === 'end') { callback(); }
            return mockTransactionStream;
          }
        };
    
        aggregateStub.returns({ cursor: () => mockTransactionStream });
        await storage.model('Transaction').addBalanceInterest();
        insertManyStub.callCount.should.equal(1);
        insertManyStub.args[0][0].length.should.equal(2);

        const interest1 = insertManyStub.args[0][0][0];
        interest1.amount.should.equal(0.5);
        interest1._debitCard.should.deep.equal(debitCard._id);
        interest1._user.should.deep.equal(user._id);

        const interest2 = insertManyStub.args[0][0][1];
        interest2.amount.should.equal(1);
        interest2._debitCard.should.deep.equal(debitCard2._id);
        interest2._user.should.deep.equal(user2._id);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });
});
