# Tandem

A two-person daily learning app. You each choose a topic, choose a third together, and get a 14-day learning Sidequest with individual progress, a shared streak, and a rotating Tonight's Challenge.

## What is included

- Create a private two-person Tandem and share a six-character invite code
- One topic pick per person plus one shared pick
- Automatic 14-day cycle once all three topics are chosen
- Three small daily learning cards
- Live partner completion status
- Shared streak that counts only when both people finish
- Tonight's Challenge, including Debate Night, Prediction, Would You Rather, Rank It, Switch Sides, and more
- Secret answers that reveal only after both people submit
- D1 persistence and secure HttpOnly device sessions
- Mobile-first responsive design
- GitHub Actions deployment workflow

## Before you begin

Install:

1. [Node.js 22](https://nodejs.org/)
2. A free [Cloudflare account](https://dash.cloudflare.com/)
3. Git

Then clone this repository:

```bash
git clone https://github.com/jdog0049/Tandem.git
cd Tandem
npm install
```

## Create the free database

Log in to Cloudflare:

```bash
npx wrangler login
```

Create the D1 database:

```bash
npx wrangler d1 create tandem-db
```

Cloudflare prints a `database_id`. Open `wrangler.jsonc` and replace:

```text
PASTE_YOUR_D1_DATABASE_ID_HERE
```

with that ID.

Apply the schema locally and start the app:

```bash
npm run db:local
npm run dev
```

Open the local URL Vite prints, normally `http://localhost:5173`.

## Deploy manually to Cloudflare

Apply the production database migration, then deploy:

```bash
npm run db:remote
npm run deploy
```

Wrangler prints your live `workers.dev` URL. Both you and your boyfriend can open that same URL. One of you chooses **Create**, then shares the invite code with the other person.

## Automatic GitHub deployment

The included workflow deploys every push to `main`. In GitHub, open:

**Settings → Secrets and variables → Actions → New repository secret**

Add:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Create the API token in Cloudflare under **My Profile → API Tokens**. Give it Workers Scripts edit and D1 edit permissions. Your Account ID is shown on the Cloudflare dashboard overview.

Run the manual setup once first so the D1 database exists and its ID is in `wrangler.jsonc`. After that, pushes to `main` deploy automatically.

## Privacy

Tandem uses a random session stored in a Secure, HttpOnly cookie. The pair invite code allows exactly one second member. Keep the code private.

For stronger protection, put the deployed Worker behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/). That lets you restrict the entire app to your two email addresses.

## Content notes

Version 1 rotates guided activity lenses across each 14-day cycle, and stores the full lesson and challenge schedule in D1 when a cycle begins. It does not send your topic choices to outside services or require a paid AI API.

A future version can add AI-generated custom curricula, spaced-repetition review, reactions, achievements, and completed-cycle archives without changing the core database structure.

## Useful commands

```bash
npm run dev          # local development
npm run typecheck    # TypeScript check
npm run build        # production build
npm run db:local     # apply migrations locally
npm run db:remote    # apply migrations to production
npm run deploy       # build and deploy
```
