import mongoose from 'mongoose';

/**
 * Helper functions for various validations and conversions
 */
const Helpers = {};

/**
 * Validates if the given email is properly formatted
 * @param {String} email - Email to validate
 * 
 * @returns {Boolean} - True if email is valid, false otherwise
 */
Helpers.isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validates if the given phone number is properly formatted
 * @param {String} phoneNumber - Phone number to validate
 * 
 * @returns {Boolean} - True if phone number is valid, false otherwise
 */
Helpers.isValidPhoneNumber = (phoneNumber) => {
  const phoneRegex = /^\d{3}-\d{3}-\d{4}$/;
  return phoneRegex.test(phoneNumber);
};

/**
 * Validates if the given date is properly formatted
 * @param {String} dateString - Date to validate
 * 
 * @returns {Boolean} - True if date is valid, false otherwise
 */
Helpers.isValidDate = (dateString) => {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

/**
 * Converts a date to a MongoDB ObjectId - used for querying by date (indexed _id vs date field)
 * @param {Date} date - Date to convert
 * 
 * @returns {ObjectId} - ObjectId created from the date
 */
Helpers.getObjectIdFromDate = (date) => {
  return mongoose.Types.ObjectId.createFromTime(new Date(date).getTime() / 1000);
};

/**
 * Validates if the given id is a valid ObjectId
 * @param {String || ObjectId} id - Id to validate
 * 
 * @returns {Boolean} - True if id is a valid ObjectId, false otherwise
 */
Helpers.isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

export default Helpers;