import sinon from 'sinon';
import * as chai from 'chai';
import storage from '../lib/storage/index.js';

const should = chai.should();

describe('User', () => {
  const user = new storage.model('User')({ firstName: 'Test', lastName: 'User', email: 'test@gmail.com' });

  let saveStub;
  let auditSaveStub;
  beforeEach(async () => {
    saveStub = sinon.stub(storage.model('User').prototype, 'save');
    auditSaveStub = sinon.stub(storage.model('User').prototype, 'auditSave');
  });

  describe('create', async () => {
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to missing or invalid firstName or lastName', async () => {
      try {
        await storage.model('User').create();
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Parameters firstName and lastName are required as strings');
      }
    });
    it('should error due to missing or invalid email', async () => {
      try {
        await storage.model('User').create({ firstName: 'Test', lastName: 'User', email: 'invalid' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Valid email is required');
      }
    });
    it('should error due to email already exists for user', async () => {
      try {
        saveStub.rejects({ code: 11000 });
        await storage.model('User').create({ firstName: 'Test', lastName: 'User', email: 'test@gmail.com' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('User already exists for provided email');
      }
    });
    it('should properly create and return a new user', async () => {
      try {
        const newUser = await storage.model('User').create({ firstName: 'Test', lastName: 'User', email: 'test@gmail.com' });
        saveStub.callCount.should.equal(1);
        (newUser instanceof storage.model('User')).should.equal(true);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('findUser', async () => {
    let userStub;
    
    beforeEach(async () => {
      userStub = sinon.stub(storage.model('User'), 'findOne');
    });
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to no id or email provided', async () => {
      try {
        await storage.model('User').findUser();
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('User id or email is required, not both');
      }
    });
    it('should error due to invalid id provided', async () => {
      try {
        await storage.model('User').findUser({ userId: 'invalid' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Invalid userId provided');
      }
    });
    it('should error due to invalid email provided', async () => {
      try {
        await storage.model('User').findUser({ email: 'invalid' });
        throw new Error('Should not reach this point');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Invalid email provided');
      }
    });
    it('should return undefined if no user was found for the params provided', async () => {
      try {
        userStub.resolves(undefined);
        const result = await storage.model('User').findUser({ email: 'fake@gmail.com' });
        should.not.exist(result);
      } catch (err) {
        should.not.exist(err);
      }
    });
    it('should return a user for the provided id', async () => {
      try {
        userStub.resolves(user);
        const result = await storage.model('User').findUser({ userId: user._id });
        (result instanceof storage.model('User')).should.equal(true);
      } catch (err) {
        should.not.exist(err);
      }
    });
  });

  describe('update', async () => {
    afterEach(async () => {
      sinon.restore();
    });

    it('should error due to invalid firstName', async () => {
      try {
        await user.update({ firstName: 123 });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Parameter firstName must be a string');
      }
    });
    it('should error due to invalid lastName', async () => {
      try {
        await user.update({ lastName: 123 });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Parameter lastName must be a string');
      }
    });
    it('should error due to invalid email', async () => {
      try {
        await user.update({ email: 'invalid' });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Parameter email must be a valid email');
      }
    });
    it('should error due to invalid phoneNumber', async () => {
      try {
        await user.update({ phoneNumber: 'invalid' });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Parameter phoneNumber must be a string in format 000-000-0000');
      }
    });
    it('should error due to invalid dateOfBirth', async () => {
      try {
        await user.update({ dateOfBirth: 'invalid' });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Parameter dateOfBirth must be a valid date');
      }
    });
    it('should error due to invalid address parameter', async () => {
      try {
        await user.update({ address: 'invalid' });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Parameter address must be an object');
      }
    });
    it('should error due to invalid city within address', async () => {
      try {
        await user.update({ address: { city: 123 } });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Address field city must be string');
      }
    });
    it('should error due to email provided already exists for user', async () => {
      try {
        auditSaveStub.rejects({ code: 11000 });
        await user.update({ email: 'exists@gmail.com' });
      } catch (err) {
        should.exist(err);
        err.message.should.equal('User already exists for provided email');
      }
    });
    it('should successfully update the fields of the user that were provided', async () => {
      try {
        const updatedUser = await user.update({ firstName: 'Updated', email: 'new@gmail.com', address: { city: 'New York' } });
        auditSaveStub.callCount.should.equal(1);
        (updatedUser instanceof storage.model('User')).should.equal(true);
        updatedUser.firstName.should.equal('Updated');
        updatedUser.email.should.equal('new@gmail.com');
        updatedUser.address.city.should.equal('New York');
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
        await user._filter();
      } catch (err) {
        should.not.exist(err);
      }
    });
  });
});
