# Rebel Riders

Rebel Riders is a biker community website where riders can discover events, request to join rides, and connect with the crew.

## How To Open The Page

1. Install dependencies:
```powershell
npm install
```

2. Create a local env file from the template:
```powershell
Copy-Item .env.example .env
```

3. Put your real Firebase values inside `.env`:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

4. Start the site:
```powershell
npm run dev
```

5. Open the local URL shown in terminal (usually `http://localhost:5173`).

## What The Page Contains

- Hero section introducing the Rebel Riders community.
- Event discovery with search and filters by event type and location.
- Ride and meetup cards with details like date, distance, and organizer.
- Event detail modal with join-interest flow.
- Rider authentication (signup, login, Google login).
- Event creation form for community-submitted rides/get-togethers.
- Admin approval queue for pending events.
- Join request approval flow for admins and event owners.
- Accessories section with rider gear cards and add-to-cart action.
- Safety and training section.
- Bikers/community section.
- Notification panel for approvals and request updates.

## If The Page Does Not Load

- Ensure `.env` exists and all `VITE_FIREBASE_*` keys are filled.
- Restart the dev server after editing `.env`.
- If terminal shows a Vite file lock/permission error, close other running Node/Vite terminals and run `npm run dev` again.

## Open On GitHub Pages

1. In the repo, go to `Settings` -> `Pages`.
2. Under `Build and deployment`, set `Source` to `GitHub Actions`.
3. Ensure all Firebase secrets are added in `Settings` -> `Secrets and variables` -> `Actions`.
4. Push to `main` (or re-run the workflow from `Actions` tab).
5. Open:

`https://shubodaya.github.io/rebel-riders/`
