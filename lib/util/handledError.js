/**
 * HandledError class to differentiate between handled and unhandled errors
 */
class HandledError extends Error {
  constructor(message, code) {
    super(message);
    this.handled = true;
    this.code = code || 500;
  }
}

export default HandledError;
