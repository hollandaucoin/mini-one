import storage from '../index.js';
import HandledError from '../../util/handledError.js';
import Helpers from '../../util/helpers.js';
import logger from '../../util/logger.js';
import { auditSave } from '../plugins.js';

// Schema for a user
const User = new storage.schema({
  firstName: String,
  lastName: String,
  email: { type: String, required: true, unique: true, validate: { validator: (v) => { return Helpers.isValidEmail(v); }, message: props => `${props.value} is an invalid email` } },
  phoneNumber: String,
  dateOfBirth: Date,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  auditLog: [{ timestamp: Date, performedBy: String, action: String }],
},
{ timestamps: true });

// Plugin auditSave for auditLog field
User.plugin(auditSave);

// ------------------------- STATIC FUNCTIONS -------------------------

/**
 * Method to create a user
 * @param {Object} params - Parameters for the user
 * @param {String} params.firstName - First name of the user
 * @param {String} params.lastName - Last name of the user
 * @param {String} params.email - Email of the user
 * 
 * @returns {User} user - New user object
 */
User.statics.create = async ({ firstName, lastName, email } = {}) => {
  try {
    // Validate the user parameters - other fields to follow in update
    if (typeof firstName !== 'string' || typeof lastName !== 'string') { throw new HandledError('Parameters firstName and lastName are required as strings', 400); }
    if (typeof email !== 'string' || !Helpers.isValidEmail(email)) { throw new HandledError('Valid email is required', 400); }

    const user = new storage.model('User')({ email, firstName, lastName });
    await user.save();

    return user;
  } catch (err) {
    if (err.code === 11000) { throw new HandledError('User already exists for provided email', 400); }
    if (err.handled) {
      logger.info(`Error creating user: ${err.message}`, { email });
      throw err;
    }
    logger.error('Error creating user', err, { email });
    throw new HandledError('Error creating user', 500);
  }
};

/**
 * Method to find a user based on parameters provided
 * @param {Object} params - Parameters to find the user
 * @param {String} params.id - Id of the user
 * @param {String} params.email - Email of the user
 * 
 * @returns {User} user - User object found
 */
User.statics.findUser = async ({ userId, email } = {}) => {
  try {
    const query = {};
    if ((!userId && !email) || (userId && email)) { throw new HandledError('User id or email is required, not both', 400); }
    if (userId) {
      if (!Helpers.isValidObjectId(userId)) { throw new HandledError('Invalid userId provided', 400); }
      query._id = userId;
    }
    if (email) {
      if (!Helpers.isValidEmail(email)) { throw new HandledError('Invalid email provided', 400); }
      query.email = email;
    }

    const user = await storage.model('User').findOne(query);
    return user;
  } catch (err) {
    if (err.handled) {
      logger.info(`Error finding user: ${err.message}`, { userId, email });
      throw err;
    }
    logger.error('Error finding user', err, { userId, email });
    throw new HandledError('Error finding user', 500);
  }
};

// ------------------------- INSTANCE METHODS -------------------------

/**
 * Method to update a users fields
 * @param {Object} params - Parameters to update on the user
 * @param {String} params.firstName - First name of the user
 * @param {String} params.lastName - Last name of the user
 * @param {String} params.email - Email of the user
 * @param {String} params.phoneNumber - Phone number of the user
 * @param {String} params.dateOfBirth - Date of birth of the user
 * @param {Object} params.address - Address of the user
 * @param {String} params.address.street - Street of the user
 * @param {String} params.address.city - City of the user
 * @param {String} params.address.state - State of the user
 * @param {String} params.address.zipCode - Zip code of the user
 * @param {String} params.address.country - Country of the user
 * 
 * @returns {User} user - Updated user object
 */
User.methods.update = async function({ firstName, lastName, email, phoneNumber, dateOfBirth, address } = {}) {
   try {
    // Validate and set the user parameters being updated
    if (firstName) {
      if (typeof firstName !== 'string') { throw new HandledError('Parameter firstName must be a string', 400); }
      this.firstName = firstName;
    }
    if (lastName) {
      if (typeof lastName !== 'string') { throw new HandledError('Parameter lastName must be a string', 400); }
      this.lastName = lastName;
    }
    if (email) {
      if (!Helpers.isValidEmail(email)) { throw new HandledError('Parameter email must be a valid email', 400); }
      this.email = email;
    }
    if (phoneNumber) {
      if (!Helpers.isValidPhoneNumber(phoneNumber)) { throw new HandledError('Parameter phoneNumber must be a string in format 000-000-0000', 400); }
      this.phoneNumber = phoneNumber;
    }
    if (dateOfBirth) {
      if (!Helpers.isValidDate(dateOfBirth) || new Date(dateOfBirth) > new Date()) { throw new HandledError('Parameter dateOfBirth must be a valid date', 400); }
      this.dateOfBirth = new Date(dateOfBirth);
    }
    if (address) {
      if (typeof address !== 'object') { throw new HandledError('Parameter address must be an object', 400); }
      Object.keys(address).forEach(key => {
        if (typeof address[key] !== 'string') { throw new HandledError(`Address field ${key} must be string`, 400); }
        this.address[key] = address[key];
      });
    }
    await this.auditSave({ performedBy: 'user', action: 'update' });
    return this;
   } catch (err) {
    if (err.code === 11000) { throw new HandledError('User already exists for provided email', 400); }
    if (err.handled) {
      logger.info(`Error updating user: ${err.message}`, { userId: this._id });
      throw err;
    }
    logger.error('Error updating user', err, { userId: this._id });
    throw new HandledError('Error updating user', 500);
   }
};

/**
 * Filter method to be used before returning to the client
 * 
 * @returns {Object} filteredUser - Filtered user object
 */
User.methods._filter = function() {
  return {
    id: this._id,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    phoneNumber: this.phoneNumber,
    dateOfBirth: this.dateOfBirth?.toISOString(),
    address: this.address,
    auditLog: this.auditLog?.map(log => {
      return { timestamp: log.timestamp, performedBy: log.performedBy, action: log.action };
    })
  };
}

export default storage.model('User', User);