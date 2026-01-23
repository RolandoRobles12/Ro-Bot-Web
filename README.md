# Ro-Bot - Slack Notification Management System

A comprehensive Slack notification management platform similar to Meta's WhatsApp Manager, built with React, TypeScript, and Firebase. Manage templates, schedule messages, and integrate with HubSpot across multiple Slack workspaces.

![Ro-Bot Dashboard](https://img.shields.io/badge/Status-Production%20Ready-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)
![React](https://img.shields.io/badge/React-18.2-blue)
![Firebase](https://img.shields.io/badge/Firebase-10.7-orange)

## Features

### Core Functionality
- ✅ **Multi-Workspace Support** - Manage multiple Slack workspaces from one dashboard
- ✅ **Template Management** - Create reusable message templates with HubSpot variables
- ✅ **Message Scheduling** - Schedule messages with recurrence patterns
- ✅ **Sender Selection** - Choose between bot or specific user tokens for sending
- ✅ **HubSpot Integration** - Use HubSpot contact/company/deal data in messages
- ✅ **Message History** - Complete audit trail of all sent messages
- ✅ **Rule Engine** - Create conditional rules for automated messaging
- ✅ **Role-Based Access** - Admin, Editor, and Viewer roles

### User Interface
- 🎨 Modern, intuitive design inspired by Slack
- 📱 Fully responsive (mobile, tablet, desktop)
- 🌙 Clean color scheme with Slack brand colors
- ⚡ Real-time updates with Firestore subscriptions
- 🔔 Toast notifications for user feedback

### Security
- 🔒 Google OAuth authentication
- 🛡️ Firestore security rules with role-based access
- 🔑 Encrypted token storage
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
- **Lucide React** - Icons
- **Sonner** - Toast notifications

### Backend
- **Firebase Authentication** - Google OAuth
- **Cloud Firestore** - NoSQL database
- **Cloud Functions** - Serverless backend
- **Cloud Scheduler** - Cron jobs for scheduled messages
- **Firebase Hosting** - Static hosting

### Integrations
- **Slack Web API** - Slack messaging
- **HubSpot API** - CRM data integration

## Project Structure

```
Ro-Bot-Web/
├── public/                   # Static assets
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Authentication components
│   │   ├── layout/         # Layout components (Sidebar, Header, etc.)
│   │   └── ui/             # Reusable UI components
│   ├── config/             # Configuration files
│   │   └── firebase.ts     # Firebase config
│   ├── hooks/              # Custom React hooks
│   │   └── useAuth.ts      # Authentication hook
│   ├── lib/                # Utility libraries
│   │   └── hubspot-variables.ts  # HubSpot variable handling
│   ├── pages/              # Page components
│   │   ├── Dashboard.tsx
│   │   ├── Templates.tsx
│   │   ├── SendMessage.tsx
│   │   ├── Workspaces.tsx
│   │   └── Login.tsx
│   ├── services/           # API services
│   │   └── firestore.ts    # Firestore CRUD operations
│   ├── store/              # Zustand stores
│   │   ├── authStore.ts
│   │   └── appStore.ts
│   ├── types/              # TypeScript types
│   │   └── index.ts
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── functions/              # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts        # Functions code
│   ├── package.json
│   └── tsconfig.json
├── firebase.json           # Firebase config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── storage.rules           # Storage security rules
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
- A Firebase project
- A Slack App with appropriate scopes
- (Optional) HubSpot account with API access

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
# Edit .env with your Firebase configuration
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

### Slack App Setup

1. Create a Slack App at [api.slack.com](https://api.slack.com/apps)
2. Add OAuth scopes: `chat:write`, `users:read`, `channels:read`, `users:read.email`
3. Install to workspace and save tokens
4. Add tokens via Workspaces page in the app

## Usage

### Creating Templates

Templates support HubSpot variables using `{{variable}}` syntax:

```
Hi {{contact.firstname}},

Welcome to {{company.name}}! Your deal {{deal.name}} is in {{deal.stage}} stage.

Best regards,
Team
```

### Sending Messages

1. Select a template or write custom message
2. Fill in variable values
3. Choose recipient (channel, user, or email)
4. Select sender (bot or user token)
5. Send immediately or schedule

### Managing Workspaces

Admins can configure multiple Slack workspaces with:
- Bot tokens for default sending
- Multiple user tokens for personalized sending
- Different sender options per message

## User Roles

- **Viewer**: Read-only access to dashboards and history
- **Editor**: Create templates, send messages, schedule
- **Admin**: Full access including workspace and user management

## Development

```bash
# Run dev server
npm run dev

# Build for production
npm run build

# Deploy to Firebase
npm run deploy

# Run functions locally
cd functions && npm run serve
```

## Security

- Google OAuth authentication required
- Role-based access control (RBAC)
- Firestore security rules enforce permissions
- Tokens stored securely in Firestore

## Roadmap

- [ ] Slack Block Kit visual builder
- [ ] Advanced cron scheduling
- [ ] Analytics dashboard with charts
- [ ] Message approval workflows
- [ ] Webhook triggers
- [ ] A/B testing
- [ ] Template marketplace
- [ ] Dark mode

## License

MIT License

---

Built with ❤️ using React, TypeScript, and Firebase