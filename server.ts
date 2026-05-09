import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resend = new Resend(process.env.RESEND_API_KEY);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.post('/api/notify-admin', async (req, res) => {
    const { reportId, userEmail, googleLama } = req.body;
    
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is not set. Skipping email.');
      return res.status(200).json({ status: 'skipped', reason: 'API_KEY_MISSING' });
    }

    try {
      await resend.emails.send({
        from: 'FF Guard <onboarding@resend.dev>',
        to: process.env.ADMIN_EMAIL || 'kytyg800@gmail.com', // Fallback to current admin
        subject: '🔔 Laporan Baru Diterima - FF Guard',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">Laporan Baru Masuk!</h2>
            <p>Seorang pengguna telah mengirimkan laporan pemulihan akun.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>ID Laporan:</strong> #${reportId}</p>
            <p><strong>Email Pengguna:</strong> ${userEmail}</p>
            <p><strong>Akun Google Lama:</strong> ${googleLama}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">Silakan cek Dashboard Admin untuk memproses.</p>
          </div>
        `
      });
      res.status(200).json({ status: 'sent' });
    } catch (error) {
      console.error('Email Error:', error);
      res.status(500).json({ status: 'error', error: String(error) });
    }
  });

  app.post('/api/notify-user-status', async (req, res) => {
    const { userEmail, googleLama, status, message } = req.body;

    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is not set. Skipping email.');
      return res.status(200).json({ status: 'skipped', reason: 'API_KEY_MISSING' });
    }

    try {
      const statusColor = status === 'SELESAI' ? '#22c55e' : status === 'GAGAL' ? '#ef4444' : '#3b82f6';
      
      await resend.emails.send({
        from: 'FF Guard <onboarding@resend.dev>',
        to: userEmail,
        subject: `Update Status Laporan: ${status} - FF Guard`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
            <h2 style="color: #f97316;">Update Status Akun Anda</h2>
            <p>Halo,</p>
            <p>Status pemulihan akun Google <strong>${googleLama}</strong> Anda telah diperbarui.</p>
            <div style="padding: 15px; background: #f8fafc; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Status Baru:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status}</span></p>
              <p style="margin: 10px 0 0 0;"><strong>Pesan Admin:</strong> <em>"${message}"</em></p>
            </div>
            <p>Terima kasih telah menggunakan jasa FF Guard.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 10px; color: #999;">Ini adalah email otomatis, mohon tidak membalas.</p>
          </div>
        `
      });
      res.status(200).json({ status: 'sent' });
    } catch (error) {
      console.error('Email Error:', error);
      res.status(500).json({ status: 'error', error: String(error) });
    }
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
