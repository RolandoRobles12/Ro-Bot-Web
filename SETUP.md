# Setup Guide - Ro-Bot Slack Manager

## Quick Start Guide

### 1. Initial Setup (5 minutes)

**Install Dependencies**
```bash
npm install
cd functions && npm install && cd ..
```

**Configure Firebase**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your Firebase config values
# Get these from: Firebase Console > Project Settings > General > Your apps
```

### 2. Firebase Project Configuration (10 minutes)

**Create Firebase Project**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Name it (e.g., "ro-bot-slack-manager")
4. Enable Google Analytics (optional)

**Enable Services**
1. Authentication > Sign-in method > Enable Google
2. Firestore Database > Create database > Start in production mode
3. Functions > Upgrade to Blaze plan (required for external APIs)
4. Hosting > Get started

**Deploy Rules & Indexes**
```bash
firebase login
firebase use --add  # Select your project
firebase deploy --only firestore:rules,firestore:indexes
```

### 3. Slack App Configuration (15 minutes)

**Create Slack App**
1. Go to [Slack API Apps](https://api.slack.com/apps)
2. Click "Create New App" > "From scratch"
3. Name: "Ro-Bot Manager" (or your choice)
4. Select your workspace

**Configure OAuth & Permissions**

Add these Bot Token Scopes:
- `chat:write` - Send messages
- `chat:write.public` - Send to channels without joining
- `users:read` - View users
- `users:read.email` - View user emails
- `channels:read` - View channels
- `groups:read` - View private channels

Add these User Token Scopes (for sending as users):
- `chat:write` - Send messages as user
- `users:read` - View users
- `channels:read` - View channels

**Install App**
1. Click "Install to Workspace"
2. Authorize the app
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
4. (Optional) Copy user tokens for specific senders

**Get Workspace Info**
1. In Slack, go to Workspace Settings
2. Note the Team ID (in URL: `T0XXXXXXX`)

### 4. User Token Setup (Optional - for sending as specific users)

To get user tokens for personalized sending:

1. In Slack App settings, go to "OAuth & Permissions"
2. Under "Redirect URLs", add: `https://your-domain.com/oauth/callback`
3. Implement OAuth flow or use Slack's token generation
4. Store tokens via the Workspaces UI

### 5. Deploy Functions (5 minutes)

```bash
firebase deploy --only functions
```

Wait for deployment to complete (~2-3 minutes)

### 6. First Run (2 minutes)

**Start Development Server**
```bash
npm run dev
```

**Access Application**
1. Open http://localhost:5173
2. Sign in with Google
3. You'll be created as a "viewer" user

**Upgrade to Admin** (First user setup)
```bash
# In Firebase Console > Firestore Database
# Find your user document (users collection)
# Change role field from "viewer" to "admin"
```

### 7. Add Your First Workspace

1. Go to Workspaces page
2. Click "Add Workspace"
3. Fill in:
   - **Name**: Your workspace name (e.g., "Marketing Team")
   - **Team ID**: Your Slack team ID (e.g., T01234567)
   - **Team Name**: Full workspace name
   - **Bot Token**: Paste your Bot User OAuth Token (xoxb-...)
4. Save

### 8. Create Your First Template

1. Go to Templates page
2. Click "New Template"
3. Create a simple template:

```
Name: Welcome Message
Description: Welcome new team members
Category: onboarding
Content:
Hi {{contact.firstname}}! 👋

Welcome to the team! We're excited to have you at {{company.name}}.

If you have any questions, feel free to reach out!
```

4. Save template

### 9. Send Your First Message

1. Go to "Send Message"
2. Select your template (or write custom message)
3. Fill in variables (if using template)
4. Choose recipient:
   - Channel: `#general` or channel ID
   - User: `@username` or user ID
   - Email: `user@example.com`
5. Select sender: Bot (default) or user token
6. Click "Send Message"

### 10. Production Deployment

**Build Application**
```bash
npm run build
```

**Deploy to Firebase Hosting**
```bash
firebase deploy --only hosting
```

**Your app will be live at:**
`https://your-project-id.web.app`

## HubSpot Integration (Optional)

### Setup HubSpot API Access

1. Go to [HubSpot Developers](https://developers.hubspot.com/)
2. Create a private app or use OAuth
3. Get API key or access token
4. Required scopes: `crm.objects.contacts.read`, `crm.objects.companies.read`

### Add HubSpot Connection

1. In Firestore, create a document in `hubspot_connections`:
```json
{
  "accessToken": "your-token",
  "portalId": "your-portal-id",
  "isActive": true,
  "scopes": ["crm.objects.contacts.read"],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Use HubSpot Variables in Templates

Available variables:
- `{{contact.firstname}}`, `{{contact.lastname}}`
- `{{contact.email}}`, `{{contact.company}}`
- `{{company.name}}`, `{{company.domain}}`
- `{{deal.name}}`, `{{deal.amount}}`

## Scheduled Messages Setup

The `processScheduledMessages` function runs every minute via Cloud Scheduler.

**Verify it's running:**
1. Firebase Console > Functions
2. Check `processScheduledMessages` logs
3. Should see: "Found X messages to send"

**Create a scheduled message:**
(This feature will be in the UI - coming soon, or add directly to Firestore for now)

```javascript
// In Firestore > scheduled_messages collection
{
  "workspaceId": "workspace-id",
  "name": "Daily standup reminder",
  "content": "Daily standup in 15 minutes! 🚀",
  "recipients": [{
    "type": "channel",
    "id": "C01234567",
    "name": "#general"
  }],
  "sender": {
    "type": "bot"
  },
  "scheduledAt": "future-timestamp",
  "status": "scheduled",
  "createdBy": "user-id",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

## Troubleshooting

### Messages not sending
- ✅ Check workspace token is valid
- ✅ Verify bot is in the channel (or use `chat:write.public` scope)
- ✅ Check Functions logs: `firebase functions:log`
- ✅ Ensure Firestore rules are deployed

### "Permission denied" in Firestore
- ✅ Run: `firebase deploy --only firestore:rules`
- ✅ Verify you're authenticated
- ✅ Check your user role in Firestore

### Functions not deploying
- ✅ Ensure project is on Blaze plan
- ✅ Check functions/package.json is correct
- ✅ Run: `cd functions && npm install`

### HubSpot variables not working
- ✅ Verify HubSpot connection exists
- ✅ Check access token is valid
- ✅ Ensure correct scopes are granted

## Environment Variables Reference

```env
# Firebase Configuration (Required)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=project-id
VITE_FIREBASE_STORAGE_BUCKET=project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Application (Optional)
VITE_APP_NAME=Ro-Bot Slack Manager
```

## User Roles & Permissions

| Feature | Viewer | Editor | Admin |
|---------|--------|--------|-------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Templates | ✅ | ✅ | ✅ |
| Create Templates | ❌ | ✅ | ✅ |
| Send Messages | ❌ | ✅ | ✅ |
| Schedule Messages | ❌ | ✅ | ✅ |
| Manage Workspaces | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |

## Next Steps

1. ✅ Invite team members (they'll start as viewers)
2. ✅ Assign appropriate roles to users
3. ✅ Create template library
4. ✅ Set up scheduled messages
5. ✅ Configure HubSpot integration
6. ✅ Test message delivery
7. ✅ Monitor usage via Dashboard

## Support

Need help? Check:
- GitHub Issues
- Firebase Console logs
- Slack API documentation
- HubSpot API documentation

---

Happy messaging! 🚀
