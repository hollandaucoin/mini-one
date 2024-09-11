import 'dotenv/config';
import http from 'http';
import express from 'express';
import session from 'express-session';
import storage from './storage/index.js';
import routes from './routes/_index.js';
import logger from './util/logger.js';
import { initializeTasks } from './util/scheduledTasks.js';

// Intialize app and define the server port
const app = express();
const PORT = process.env.PORT || 8000;

// Connect to the database and initialize
await storage.connect();

// Middleware
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));
// Parse the request
app.use(express.urlencoded({ extended: false }));
// Takes care of JSON data
app.use(express.json());

// Load all routes and add to server
await routes.loadRoutes();
app.use('/api', routes.router);

// Initialize scheduled tasks
await initializeTasks();

// Define the rules of the API
app.use((req, res, next) => {
  // Set the CORS policy
  res.header('Access-Control-Allow-Origin', '*');
  // Set the CORS headers
  res.header('Access-Control-Allow-Headers', 'origin, X-Requested-With, Content-Type, Accept, Authorization');
  // Set the CORS method headers
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET PATCH DELETE POST PUT');
    return res.status(200).json({});
  }
  return next();
});

// Start the server
const httpServer = http.createServer(app);
httpServer.listen(PORT, () => {
  logger.info('Server is running', { port: PORT });
});
