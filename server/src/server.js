import 'dotenv/config';
import { app } from './app.js';

const PORT = process.env.PORT || 4000;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
