const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDB } = require('../db');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = process.env.UPLOADS_PATH
      ? path.join(process.env.UPLOADS_PATH, 'photos')
      : path.join(__dirname, '../uploads/photos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${req.user.id}${ext}`);
  }
});
const photoUpload = multer({
  storage: photoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Apenas jpg, png ou webp'));
  }
});

// POST /login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      crm_access: user.crm_access
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /me
router.get('/me', (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT id, name, email, role, crm_access, commission_percent, active, photo_url FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /profile - update own password
router.patch('/profile', (req, res) => {
  try {
    const db = getDB();
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter ao menos 6 caracteres' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /profile/photo - upload own photo
router.post('/profile/photo', photoUpload.single('photo'), (req, res) => {
  try {
    const db = getDB();
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const photo_url = `/uploads/photos/${req.user.id}${ext}`;
    db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photo_url, req.user.id);
    res.json({ photo_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /profile/photo - remove own photo
router.delete('/profile/photo', (req, res) => {
  try {
    const db = getDB();
    const user = db.prepare('SELECT photo_url FROM users WHERE id = ?').get(req.user.id);
    if (user?.photo_url) {
      const filePath = path.join(__dirname, '..', user.photo_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE users SET photo_url = NULL WHERE id = ?').run(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /logout (client-side only, just returns ok)
router.post('/logout', (req, res) => {
  res.json({ success: true });
});

module.exports = router;
