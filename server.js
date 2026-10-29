// خادم تجريبي آمن نسبيًا لمنصة تاريخ الرقي.
// يتطلب Node.js 20 أو أحدث. لا تنشره قبل ضبط SESSION_SECRET وHTTPS.
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);
const PORT = Number(process.env.PORT || 3000);
const production = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('خطأ: عيّن SESSION_SECRET بطول 32 حرفًا على الأقل قبل تشغيل الخادم.');
  process.exit(1);
}

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

app.disable('x-powered-by');
app.set('trust proxy', production ? 1 : false);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      imgSrc: ["'self'", 'https://i.postimg.cc', 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: production ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '12kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '12kb' }));

app.use(session({
  name: 'tr.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 8
  },
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: dataDir,
    concurrentDB: true
  })
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'محاولات كتير في وقت قصير. استنى شوية وجرب تاني.' }
});

const db = require('better-sqlite3')(path.join(dataDir, 'students.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    grade TEXT NOT NULL,
    gender TEXT NOT NULL DEFAULT 'male',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const bcrypt = require('bcryptjs');
const GRADES = new Set([
  'الأول الثانوي',
  'الثاني الثانوي',
  'الثاني الثانوي (البكالوريا)',
  'الثالث الثانوي'
]);

function normalizePhone(value) {
  return String(value || '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\s+/g, '')
    .trim();
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    grade: user.grade,
    gender: user.gender
  };
}

function requireUser(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'سجّل دخولك الأول.' });
  }
  next();
}

app.use('/api/auth', authLimiter);

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim().replace(/\s+/g, ' ');
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || '');
    const grade = String(req.body?.grade || '');
    const gender = String(req.body?.gender || 'male');

    if (name.length < 5 || name.length > 90 || name.split(' ').length < 3) {
      return res.status(400).json({ message: 'اكتب اسمك الثلاثي بشكل صحيح.' });
    }
    if (!/^01[0125]\d{8}$/.test(phone)) {
      return res.status(400).json({ message: 'رقم الموبايل المصري غير صحيح.' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ message: 'كلمة المرور لازم تكون من 8 إلى 72 حرفًا.' });
    }
    if (!GRADES.has(grade)) {
      return res.status(400).json({ message: 'اختار الصف الدراسي من القائمة.' });
    }
    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({ message: 'اختار ستايل المنصة من القائمة.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (existing) {
      return res.status(409).json({ message: 'الرقم ده مسجل بالفعل. اختار تسجيل الدخول.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(`
      INSERT INTO users (name, phone, password_hash, grade, gender)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, phone, passwordHash, grade, gender);

    req.session.regenerate(error => {
      if (error) return next(error);
      req.session.userId = Number(result.lastInsertRowid);
      req.session.save(saveError => {
        if (saveError) return next(saveError);
        const user = db.prepare('SELECT id,name,phone,grade,gender FROM users WHERE id = ?')
          .get(Number(result.lastInsertRowid));
        res.status(201).json({ user: publicUser(user) });
      });
    });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ message: 'الرقم ده مسجل بالفعل.' });
    }
    next(error);
  }
});

app.post('/api/auth/login', (req, res, next) => {
  const phone = normalizePhone(req.body?.phone);
  const password = String(req.body?.password || '');

  if (!/^01[0125]\d{8}$/.test(phone) || password.length < 1 || password.length > 72) {
    return res.status(400).json({ message: 'راجع رقم الموبايل وكلمة المرور.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);

  // رسالة واحدة لتقليل كشف ما إذا كان الرقم مسجلًا.
  const hashToCheck = user
    ? user.password_hash
    : '$2a$12$C6UzMDM.H6dfI/f/IKcEe.3d4z5K6v7N8o9P0q1r2s3t4u5v6w7x8';

  bcrypt.compare(password, hashToCheck, (error, matched) => {
    if (error) return next(error);

    if (!user || !matched) {
      return res.status(401).json({ message: 'رقم الموبايل أو كلمة المرور غير صحيحة.' });
    }

    req.session.regenerate(sessionError => {
      if (sessionError) return next(sessionError);
      req.session.userId = user.id;
      req.session.save(saveError => {
        if (saveError) return next(saveError);
        res.json({ user: publicUser(user) });
      });
    });
  });
});

app.get('/api/auth/me', requireUser, (req, res) => {
  const user = db.prepare('SELECT id,name,phone,grade,gender FROM users WHERE id = ?')
    .get(req.session.userId);

  if (!user) {
    return req.session.destroy(() => res.status(401).json({ message: 'الحساب غير موجود.' }));
  }

  res.set('Cache-Control', 'no-store');
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(error => {
    if (error) return res.status(500).json({ message: 'تعذّر إنهاء الجلسة.' });
    res.clearCookie('tr.sid', {
      httpOnly: true,
      secure: production,
      sameSite: 'strict'
    });
    res.status(204).end();
  });
});

// تقديم الواجهة من نفس الخادم حتى تعمل جلسة الحساب من نفس النطاق.
app.use(express.static(__dirname, {
  index: 'index.html',
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (/\.(html|js|css)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use((error, req, res, next) => {
  console.error('Server error:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ message: 'حصل خطأ في الخادم. جرّب مرة تانية.' });
});

app.listen(PORT, () => {
  console.log(`تاريخ الرقي شغال على http://localhost:${PORT}`);
});
