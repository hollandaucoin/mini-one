import Storage from '../lib/storage/index.js';

// Load in the models before running tests to be able to use Storage.model('ModelName')
await Storage.loadModels();