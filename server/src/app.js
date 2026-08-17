import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

export const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
