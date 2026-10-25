import express from 'express';
import { createServer as createViteServer } from 'vite';
import handler from './api/total-visitors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// API Route for Total Visitors
app.get('/api/total-visitors', async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error('Error handling /api/total-visitors:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

start();
