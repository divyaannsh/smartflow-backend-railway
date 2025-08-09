# SmartFlow Backend - Railway Deployment

## Quick Deploy to Railway

1. **Fork/Clone this repository**
2. **Go to [Railway.app](https://railway.app)**
3. **Create new project → Deploy from GitHub repo**
4. **Select this repository**
5. **Set Environment Variables:**
   - `NODE_ENV=production`
   - `JWT_SECRET=your-strong-secret-key-here`
   - `FRONTEND_URL=https://your-vercel-frontend.vercel.app`
   - `DB_FILE=/data/project_manager.db`

## Why Railway?

- ✅ **Persistent Storage**: SQLite database persists between restarts
- ✅ **Free Tier**: 500 hours/month free
- ✅ **Auto-deploy**: Deploys on every git push
- ✅ **Custom Domains**: Add your own domain
- ✅ **Environment Variables**: Secure secret management

## Database Persistence

Railway provides persistent disk storage at `/data/` which is perfect for SQLite databases. Your admin user and all data will persist between deployments.

## Health Check

The app includes a health check endpoint at `/api/health` for Railway monitoring.

## CORS Configuration

The backend automatically allows your Vercel frontend domain. Just set `FRONTEND_URL` in Railway environment variables.
