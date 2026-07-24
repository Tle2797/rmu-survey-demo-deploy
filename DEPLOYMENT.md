# RMU Survey Demo Deployment

This branch is intended for the isolated demo deployment.

## Services

- Frontend: Vercel, root directory `client`
- Backend: Render Docker web service, root directory `backend`
- Database: a new PostgreSQL database used only by this demo
- Email: Resend

## Safety rules

- Do not use the university database credentials.
- Do not point `NEXT_PUBLIC_API_URL` to `iqa-api.rmu.ac.th`.
- Do not attach the demo services to an existing RMU Vercel or Render project.
- Keep all `.env` files out of Git.

## Frontend environment

```dotenv
NEXT_PUBLIC_API_URL=https://your-new-backend.onrender.com
```

## Backend environment

Copy the keys from `backend/.env.example` into Render and replace every
placeholder with values created for the demo environment.

The PostgreSQL schema in `db_survey.sql` must be imported before the backend
starts for the first time.

## Initialize the demo database

1. Copy `backend/.env.bootstrap.example` to
   `backend/.env.bootstrap.local`.
2. Add the new database's external URL and choose the initial admin credentials.
3. From the `backend` directory, run:

```bash
bun run bootstrap:demo
```

The local bootstrap file is ignored by Git and must never be committed.
