# Castaway

Juego web de supervivencia en una isla desierta.

## Tecnologías

- Frontend: Angular, TypeScript, SCSS
- Backend: Node.js, Express, TypeScript
- Base de datos: PostgreSQL
- ORM: Prisma

## Backend

```bash
cd backend
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

El backend queda disponible en `http://localhost:3000`.

Endpoint de prueba:

```text
GET http://localhost:3000/api/health
```

## Frontend

```bash
cd frontend
npm install
npm start
```

Angular queda disponible en `http://localhost:4200`.

En PowerShell, si la política de ejecución bloquea `npm`, usa `npm.cmd` en los mismos comandos.

## Variables de entorno

Configura `backend/.env` a partir de `backend/.env.example`.

```env
PORT=3000
DATABASE_URL="postgresql://postgres:root@localhost:5432/castaway_db?schema=public"
FRONTEND_URL="http://localhost:4200,http://127.0.0.1:4200"
```

Asegúrate de que `DATABASE_URL` apunte a una base PostgreSQL existente y con credenciales válidas antes de ejecutar `npm run prisma:migrate`.
