# מערכת POS/קופה - Quick Start

## 🎯 הקמה מהירה (5 דקות)

### 1. התקן Dependencies
```bash
# Backend
cd backend
npm install

# Frontend  
cd ../frontend
npm install react-router-dom zustand axios date-fns xlsx
```

### 2. הגדר Database
```bash
# אם יש Docker:
docker run --name pos-postgres -e POSTGRES_PASSWORD=admin -e POSTGRES_DB=pos_db -p 5432:5432 -d postgres:15

# אחרת: התקן PostgreSQL והפעל אותו
```

### 3. צור `.env` ב-Backend
```bash
cd backend
cp .env.example .env
```

ערוך `.env`:
```
DATABASE_URL="postgresql://postgres:admin@localhost:5432/pos_db"
JWT_SECRET="your-secret-key-change-me"
```

### 4. הפעל Database Migration
```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
node scripts/createAdmin.js
```

### 5. הפעל את המערכת
```bash
# טרמינל 1 - Backend
cd backend
npm run dev

# טרמינל 2 - Frontend
cd frontend
npm run dev
```

### 6. התחבר
- **URL**: http://localhost:5173
- **Username**: admin
- **Password**: admin123

---

## 📂 מבנה הפרויקט

```
hanut/
├── backend/                 # Node.js + Express + Prisma
│   ├── prisma/
│   │   └── schema.prisma    # Database schema (7 tables)
│   ├── src/
│   │   ├── routes/          # API routes (auth, users, wallets, etc.)
│   │   ├── middleware/      # Auth, error handling
│   │   ├── config/          # Database config
│   │   ├── utils/           # Logger
│   │   └── server.js        # Express app
│   ├── scripts/
│   │   └── createAdmin.js   # Admin user creation
│   └── package.json
│
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── store/           # Zustand stores (auth, cart)
│   │   ├── services/        # API services
│   │   ├── components/      # React components (TODO)
│   │   ├── pages/           # Pages (TODO)
│   │   └── App.jsx
│   └── package.json
│
├── SETUP.md                 # הוראות התקנה מפורטות
└── README.md                # זה הקובץ
```

---

## 🔑 משתמשים לדוגמה

לאחר הרצת `createAdmin.js`:

| Username | Password | Role | תיאור |
|----------|----------|------|-------|
| admin | admin123 | admin | מנהל מערכת - גישה מלאה |

---

## 🚧 מצב הפרויקט

### ✅ הושלם
- [x] Backend API מלא (7 routes)
- [x] Database schema (7 tables)- (JWT)
- [x] Frontend structure (Vite + React)
- [x] State management (Zustand)
- [x] API services

### 🔨 בתהליך
- [ ] React components
- [ ] Routing setup
- [ ] Login page
- [ ] Admin dashboard
- [ ] POS interface

### 📋 הבא בתור
1. בניית Login page
2. Protected routes
3. Admin layout + sidebar
4. User management interface
5. Wallet management
6. POS cashier interface

---

## 📞 עזרה

ראה **SETUP.md** להוראות מפורטות ופתרון בעיות.
