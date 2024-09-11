import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';
import mongoose from 'mongoose';
import logger from '../util/logger.js';

const dbUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mini-one';
let dbInitialized = false;

/**
 * Storage object for MongoDB connection and model management
 */
const Storage = {
  model: mongoose.model,
  schema: mongoose.Schema,
};

/**
 * Connect to the MongoDB database and set up event listeners
 */
Storage.connect = async () => {
  mongoose.connection.once('open', () => {
    logger.info('MongoDB connection open');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
  });
  
  try {      
    await mongoose.connect(dbUri);
    logger.info('MongoDB connected successfully');
    if (!dbInitialized) {
      await Storage.loadModels();
      dbInitialized = true;
      logger.info('MongoDB initialized successfully');
    }
  } catch (err) {
    logger.error('MongoDB connection or initialization error', err);
  }
};

/**
 * Dynamically load all model files from the models directory
 */
Storage.loadModels = async () => {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const files = await readdir(__dirname + '/models');
  const modelPromises = files.map(file => import(__dirname + '/models/' + file));
  await Promise.all(modelPromises);
}


export default Storage;