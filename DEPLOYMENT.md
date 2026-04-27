# Deployment Guide: PisoWiFi Centralized Income System

This system comprises a Node.js Express backend and a React (Vite) frontend. It utilizes a SQLite database for robust local data storage and node-cron for automated daily scraping tasks.

## Local Development

Ensure you have Node.js 18+ installed.

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Setup:**
    Rename `.env.example` to `.env` and update the necessary secrets.
    ```bash
    cp .env.example .env
    ```

3.  **Run Development Server:**
    Run the full-stack server using `tsx`:
    ```bash
    npm run dev
    ```
    The application will be accessible at `http://localhost:3000`.

## Production Deployment (e.g., Cloud Run or VPS)

1.  **Build the application:**
    This command bundles the frontend React application into `dist/`, and uses `esbuild` to bundle the Express server into `dist/server.js`.
    ```bash
    npm run build
    ```

2.  **Production Run:**
    Execute the bundled server application mapping to port 3000.
    ```bash
    npm start
    ```
    Wait, you'll need the SQLite file `database.sqlite` to be writeable. Make sure that the deployment path supports read-write permissions where the app relies on it.

    **Note for ZeroTier Networking:**
    Because your PisoWiFi devices rely on ZeroTier for local IP tunneling (e.g. `10.147.x.x`), your production host server MUST also be joined to the ZeroTier network to securely scrape the instances. Ensure that your VPS or local orchestrator has ZeroTier properly configured and authorized by your ZeroTier Controller. Provide your host route maps if the deployment operates remotely from the physical mesh router.

## Scraper Strategy
Currently, due to offline execution capabilities, the scraper uses a mocked routine.
To implement the **real** PisoFi scraper:
1. Open `backend/scraper.ts`
2. Uncomment the Axios/Cheerio lines at line `14` through `26`.
3. Modify the Cheerio selector (`$('#daily-income')`) to exactly match the target HTML element retrieved from your actual PisoFi device admin panel.
4. Redeploy.

## Auto-Restart
It is recommended to deploy using PM2 for local VPS installs:
```bash
npm install -g pm2
pm2 start npm --name "pisowifi" -- run start
```
