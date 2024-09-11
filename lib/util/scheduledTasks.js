import cron from 'node-cron';
import storage from '../storage/index.js';
import logger from './logger.js';

/**
 * Initialize scheduled tasks for the application
 */
export const initializeTasks = async () => {

  // List of tasks - timer syntax below
  const tasks = [
    { timer: '*/4 * * * *', model: storage.model('Transaction'), method: 'validatePending' },
    { timer: '*/10 * * * *', model: storage.model('Transaction'), method: 'addBalanceInterest' },
  ];
  
  for (const task of tasks) {
    // Task validation - throw error to identify misconfigured tasks on startup
    if (!task.model || !task.method || !task.model[task.method]) {
      throw new Error('Task misconfigured, model required with an associated method');
    }

    cron.schedule(task.timer, async () => {
      try {
        logger.info(`Starting task: ${task.model.modelName}.${task.method}`);
        await task.model[task.method]();
        logger.info(`Finished task: ${task.model.modelName}.${task.method}`);
      } catch (err) {
        logger.error(`Errored on task: ${task.model.modelName}.${task.method}`, err);
      }
    });
  }
};


/**
  Cron timer syntax:
  * * * * * *
  | | | | | |
  | | | | | day of week
  | | | | month
  | | | day of month
  | | hour
  | minute
  second (optional)

  Examples:
  - * * * * * = every minute
  - 0 * * * * = every hour
  - 0 0 * * 0 = every Sunday at midnight
  - 0 0 1 * * = every first of the month at midnight
  - * * * * 1-5 = every weekday at midnight
  - * /5 * * * * every 5 minutes (no space)
*/