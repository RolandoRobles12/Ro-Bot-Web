# Ro-Bot - Slack Sales Campaign & Notification Platform

A Slack campaign, notification, and sales-performance messaging platform built with React, TypeScript, and Firebase. Ro-Bot combines a rule engine, a scheduler, live data sources (HubSpot, Google Sheets, external Firebase sales data), and an AI-assisted campaign builder to send targeted, data-driven messages to Slack workspaces.

![Ro-Bot Dashboard](https://img.shields.io/badge/Status-Production%20Ready-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)
![React](https://img.shields.io/badge/React-18.2-blue)
![Firebase](https://img.shields.io/badge/Firebase-10.7-orange)

## Features

### Core Functionality
- ✅ **Multi-Workspace Support** - Manage multiple Slack workspaces from one dashboard
- ✅ **Template Management** - Create reusable message templates with HubSpot/data-source variables
- ✅ **Message Scheduling** - Schedule one-off and recurring messages (daily, weekly, monthly, cron)
- ✅ **Campaigns** - Multi-step, data-driven message campaigns with recipient targeting and A/B message variants
- ✅ **Rule Engine** - Conditional rules with metric calculations (sum, average, count, etc.) that trigger messages
- ✅ **Data Sources** - Pull live data from HubSpot pipelines/properties, Google Sheets, manual entries, or APIs
- ✅ **AI Campaign Builder** - Conversational assistant (OpenAI) that helps configure campaigns and generate message copy
- ✅ **Sales Performance Tracking** - Sales users, performance metrics, tactical cards, follow-ups, and coaching sessions, optionally sourced from an external Firebase project
- ✅ **HubSpot Integration** - Use HubSpot contact/company/deal/pipeline data in messages
- ✅ **Message History** - Complete audit trail of sent messages and campaign executions
- ✅ **Teams & Role-Based Access** - Admin, Editor, and Viewer roles, plus team management

### User Interface
- 🎨 Modern, intuitive design inspired by Slack (interfaz en español)
- 📱 Fully responsive (mobile, tablet, desktop)
- 🌙 Clean color scheme with Slack brand colors
- ⚡ Real-time updates with Firestore subscriptions
- 🔔 Toast notifications for user feedback

### Security
- 🔒 Google OAuth authentication
- 🛡️ Firestore security rules with role-based access
- 🔑 Encrypted/secret-backed token storage (Slack, HubSpot, OpenAI, external Firebase)
- ✅ Input validation and sanitization

## Tech Stack

### Frontend
- **React 18.2** - UI framework
- **TypeScript 5.2** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **React Router** - Navigation
- **React Hook Form** - Form handling
- **React Select** - Advanced selects
- **React Datepicker** - Date/time pickers for scheduling
- **cron-parser** - Cron expression parsing for recurring schedules
- **date-fns** - Date utilities
- **Lucide React** - Icons
- **Sonner** - Toast notifications

### Backend
- **Firebase Authentication** - Google OAuth
- **Cloud Firestore** - NoSQL database
- **Cloud Functions** - Serverless backend (Slack messaging, scheduling, campaigns, AI agent)
- **Cloud Scheduler / Pub/Sub** - Cron jobs for scheduled messages and campaigns
- **Firebase Hosting** - Static hosting

### Integrations
- **Slack Web API** - Messaging, channels, users, interactive components
- **HubSpot API** - CRM contacts/companies/deals and pipeline stages
- **Google Sheets API** - External data source for campaigns and metrics
- **OpenAI API** (`gpt-4o-mini`) - AI message generation and the AI campaign builder
- **External Firebase project (optional)** - Read sales users/goals from a separate Firebase project

## Project Structure

```
Ro-Bot-Web/
├── public/                    # Static assets
├── src/
│   ├── components/
│   │   ├── auth/              # ProtectedRoute
│   │   ├── layout/             # Layout, Header, Sidebar
│   │   └── ui/                 # Button, Card, Input, Modal, FileUpload
│   ├── config/
│   │   └── firebase.ts         # Firebase config (+ external Firebase app)
│   ├── hooks/
│   │   └── useAuth.ts          # Authentication hook
│   ├── lib/
│   │   └── hubspot-variables.ts  # HubSpot/data-source variable handling
│   ├── pages/
│   │   ├── Dashboard.tsx       # Panel
│   │   ├── Templates.tsx       # Plantillas
│   │   ├── SendMessage.tsx     # Enviar Mensaje
│   │   ├── Scheduler.tsx       # Programador (schedules & campaigns)
│   │   ├── DataSources.tsx     # Fuentes de Datos
│   │   ├── AgentBuilder.tsx    # Constructor IA (AI campaign builder)
│   │   ├── Rules.tsx           # Reglas
│   │   ├── Teams.tsx           # Equipos
│   │   ├── Workspaces.tsx      # Workspaces de Slack
│   │   ├── UsersAdmin.tsx      # Usuarios
│   │   ├── Settings.tsx        # Configuración e Integraciones
│   │   └── Login.tsx
│   ├── services/
│   │   ├── firestore.ts        # Firestore CRUD operations
│   │   ├── cloudFunctions.ts   # Cloud Functions client calls
│   │   └── storageService.ts   # Firebase Storage helpers
│   ├── store/                  # Zustand stores
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   ├── types/
│   │   └── index.ts            # Shared TypeScript types
│   ├── App.tsx                 # Routes
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── functions/                  # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts            # sendSlackMessage, processScheduledMessages,
│   │                            # processCampaigns, agentBuildCampaign, agentStream,
│   │                            # calculateSalesMetrics, readGoogleSheet, etc.
│   ├── package.json
│   └── tsconfig.json
├── firebase.json                # Firebase config
├── firestore.rules              # Firestore security rules
├── firestore.indexes.json       # Firestore indexes
├── storage.rules                # Storage security rules
├── SETUP.md                     # Step-by-step setup guide
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project (Blaze plan, required for external API calls from Cloud Functions)
- A Slack App with appropriate scopes
- (Optional) HubSpot account with API access
- (Optional) OpenAI API key for AI message generation and the AI campaign builder
- (Optional) A second Firebase project if sales users/goals live in an external project

### Installation

1. **Clone and Install**
```bash
git clone <repository-url>
cd Ro-Bot-Web
npm install
cd functions && npm install && cd ..
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your Firebase configuration (see SETUP.md for details)
```

3. **Firebase Setup**
```bash
firebase login
firebase init  # Select Firestore, Functions, Hosting
```

4. **Deploy Infrastructure**
```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

5. **Run Development Server**
```bash
npm run dev
```

For the full walkthrough (Slack app setup, HubSpot connection, Google Sheets, OpenAI key, external Firebase config), see [SETUP.md](./SETUP.md).

### Slack App Setup

1. Create a Slack App at [api.slack.com](https://api.slack.com/apps)
2. Add OAuth scopes: `chat:write`, `chat:write.public`, `users:read`, `channels:read`, `users:read.email`
3. Install to workspace and save tokens
4. Add tokens via the Workspaces page in the app

## Usage

### Creating Templates

Templates support variables from HubSpot and other configured data sources using `{{variable}}` syntax:

```
Hi {{contact.firstname}},

Welcome to {{company.name}}! Your deal {{deal.name}} is in {{deal.stage}} stage.

Best regards,
Team
```

### Sending Messages

1. Select a template or write a custom message
2. Fill in variable values
3. Choose recipient (channel, user, or email)
4. Select sender (bot or user token)
5. Send immediately or schedule

### Campaigns & Scheduling

The Scheduler page manages one-off/recurring scheduled messages as well as multi-step campaigns that:
- Pull recipients and variables from one or more **Data Sources** (HubSpot pipeline/property, Google Sheets, manual, or API)
- Support message variants for A/B style sending
- Run on a schedule via Cloud Scheduler / Pub/Sub (`processScheduledMessages`, `processCampaigns`)

### Rules

The Rules page defines conditional logic (metric calculations + conditions) that automatically triggers messages or campaign actions based on data-source values.

### AI Campaign Builder

The "Constructor IA" page provides a conversational assistant (backed by `agentBuildCampaign` / `agentStream` Cloud Functions and an OpenAI API key configured in Settings → Integraciones) that helps configure a campaign's data sources, recipients, and message copy from a natural-language description.

### Managing Workspaces

Admins can configure multiple Slack workspaces with:
- Bot tokens for default sending
- Multiple user tokens for personalized sending
- Different sender options per message

## User Roles

- **Viewer**: Read-only access to dashboards and history
- **Editor**: Create templates, rules, data sources, campaigns; send and schedule messages
- **Admin**: Full access including workspaces, teams, and user management

## Development

```bash
# Run dev server
npm run dev

# Type-check and build for production
npm run build

# Lint
npm run lint

# Deploy (build + firebase deploy)
npm run deploy

# Run functions locally
cd functions && npm run serve
```

## Security

- Google OAuth authentication required
- Role-based access control (RBAC)
- Firestore security rules enforce permissions
- Slack/HubSpot/OpenAI tokens and the external Firebase service account stored securely in Firestore/Cloud Functions secrets

## Roadmap

- [ ] Slack Block Kit visual builder
- [ ] Analytics dashboard with charts
- [ ] Message approval workflows
- [ ] Webhook triggers
- [ ] Template marketplace
- [ ] Dark mode

## License

MIT License

---

Built with ❤️ using React, TypeScript, and Firebase
