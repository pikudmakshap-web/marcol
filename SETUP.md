# מערכת POS/קופה - הוראות הקמה

## ✅ מה כבר נוצר

### Backend (JavaScript/Node.js)
- **Prisma Schema** - 7 טבלאות (users, wallets, products, inventory, transactions, etc.)
- **Express Server** - `src/server.js`
- **Routes** - 7 קבצי routes (auth, user, wallet, product, inventory, transaction, report)
- **Middleware** - Authentication, Error Handler
- **Logger** - Winston logging
- **Database Config** - Prisma client

### Frontend (React + Vite)
- **Vite Project** - מאותחל
- **Stores** - Zustand (authStore, cartStore)
- **Services** - API client, authService
- **.env** - קובץ הגדרות

---

## 📦 שלב 1: התקנת Dependencies

### Backend
```bash
cd backend
npm install
```

זה יתקין:
- express, @prisma/client, bcrypt, jsonwebtoken
- cors, dotenv, joi, winston
- prisma, nodemon (dev)

### Frontend
```bash
cd frontend

# עדכן את package.json להוסיף:
npm install react-router-dom zustand axios date-fns xlsx
```

---

## 🗄️ שלב 2: הגדרת PostgreSQL Database

### אופציה א': התקנה מקומית (Windows)
1. הורד PostgreSQL: https://www.postgresql.org/download/windows/
2. התקן עם pgAdmin
3. צור Database חדש בשם `pos_db`

### אופציה ב': Docker (מומלץ)
```bash
docker run --name pos-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pos_db -p 5432:5432 -d postgres:15
```

---

## ⚙️ שלב 3: הגדרת `.env` ב-Backend

צור קובץ `.env` בתיקיית `backend`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/pos_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-me"
JWT_EXPIRES_IN="24h"
PORT=3000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
```

**⚠️ חשוב:** שנה את `JWT_SECRET` למשהו ייחודי!

---

## 🔧 שלב 4: הרצת Prisma Migrations

```bash
cd backend

# יצירת Prisma Client
npx prisma generate

# הרצת Migration (יוצר את הטבלאות ב-DB)
npx prisma migrate dev --name init

# (אופציונלי) פתיחת Prisma Studio לצפייה ב-DB
npx prisma studio
```

---

## 👤 שלב 5: יצירת משתמש Admin ראשוני

אחרי ש-Database מוכן, נצור משתמש admin ראשון:

### דרך א': דרך Prisma Studio
1. הרץ `npx prisma studio` (בתיקיית backend)
2. פתח את טבלת `User`
3. לחץ "Add record"
4. הזן:
   - username: `admin`
   - passwordHash: (ראה למטה איך ליצור hash)
   - fullName: `מנהל מערכת`
   - role: `admin`
   - isActive: `true`

### דרך ב': סקריפט כלי עזר

צור קובץ `backend/scripts/createAdmin.js`:

```javascript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash,
      fullName: 'מנהל מערכת',
      role: 'admin',
      personalNumber: '1000',
      barcode: 'ADMIN001',
      isActive: true
    }
  });

  console.log('✅ Admin user created:', admin);
}

createAdmin()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

הרץ:
```bash
node scripts/createAdmin.js
```

---

## 🚀 שלב 6: הפעלת המערכת

### טרמינל 1 - Backend
```bash
cd backend
npm run dev
```

אמור לראות:
```
🚀 Server running on port 3000
✅ Database connected
```

### טרמינל 2 - Frontend
```bash
cd frontend
npm run dev
```

אמור לראות:
```
VITE ready in XXX ms
➜ Local: http://localhost:5173/
```

---

## 🧪 בדיקת המערכת

1. **פתח דפדפן**: http://localhost:5173
2. **נסה להתחבר**:
   - Username: `admin`
   - Password: `admin123`

אם הכל עובד - תראה הודעה בקונסול של הדפדפן או תועבר לדאשבורד!

---

## 📝 הצעדים הבאים

עכשיו צריך ליצור את:
1. **Component-ים של React** (Login, Dashboard, POS, etc.)
2. **Routing** עם React Router
3. **CSS/Design** לפי העיצובים מ-Stitch
4. **שאר ה-Services** (userService, walletService, etc.)

האם תרצה שאמשיך ליצור את הקומפוננטות?

---

## ❗ פתרון בעיות נפוצות

### Backend לא מתחבר ל-Database
- ודא ש-PostgreSQL רץ
- בדוק את ה-`DATABASE_URL` ב-`.env`
- הרץ `npx prisma db push` אם היו שינויים

### CORS Errors
- ודא ש-`FRONTEND_URL` ב-Backend תואם ל-Frontend port
- בדוק שה-Backend רץ על port 3000

### JWT Errors
- ודא ש-`JWT_SECRET` מוגדר ב-`.env`
- נקה localStorage בדפדפן
