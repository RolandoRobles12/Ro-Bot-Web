#!/bin/bash

# Deployment Script for Ro-Bot Slack Manager

echo "🚀 Ro-Bot Deployment Script"
echo ""

# Step 1: Pull latest changes
echo "📥 Step 1: Pulling latest changes from GitHub..."
git pull
if [ $? -ne 0 ]; then
    echo "❌ Failed to pull changes. Please check your connection."
    exit 1
fi
echo "✅ Code updated successfully!"
echo ""

# Step 2: Deploy Firestore rules
echo "🔐 Step 2: Deploying Firestore security rules..."
firebase deploy --only firestore:rules,firestore:indexes
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Firestore rules. Check Firebase CLI setup."
    exit 1
fi
echo "✅ Firestore rules deployed successfully!"
echo ""

# Step 3: Build and deploy Functions
echo "⚙️  Step 3: Building and deploying Cloud Functions..."
firebase deploy --only functions
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy Functions. Check the error above."
    exit 1
fi
echo "✅ Cloud Functions deployed successfully!"
echo ""

echo "🎉 Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Restart your dev server: npm run dev"
echo "  2. Refresh your browser (F5)"
echo "  3. Try creating a workspace and sending a test message"
echo ""
