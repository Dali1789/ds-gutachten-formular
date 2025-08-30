#!/bin/bash

echo "=== Railway Deployment Script ==="
echo "Setting up environment variables for ds-gutachten-formular"

# Check if railway CLI is authenticated
if ! railway status > /dev/null 2>&1; then
  echo "ERROR: Railway CLI not authenticated"
  echo "Please run: railway login"
  exit 1
fi

# Navigate to project
cd "/home/dali/Projects in Development/DS Gutachten Formular"

echo "Current directory: $(pwd)"
echo "Project files:"
ls -la

echo ""
echo "=== Setting Environment Variables ==="

# Set environment variables from the screenshot requirements
echo "Setting PORT..."
railway variables set PORT=3000

echo "Setting NODE_ENV..."
railway variables set NODE_ENV=production

echo "Setting NOTION_TOKEN..."
railway variables set NOTION_TOKEN=secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

echo "Setting KONTAKTE_DATABASE_ID..."
railway variables set KONTAKTE_DATABASE_ID=25b5e4b84c4481d39e4fc8bbf27edf01

echo "Setting BUSINESS_RESOURCES_DATABASE_ID..."
railway variables set BUSINESS_RESOURCES_DATABASE_ID=25b5e4b84c448133ba41f551dd68717b

echo "Setting GOOGLE_CREDENTIALS..."
# This needs to be set from the actual credentials JSON
railway variables set GOOGLE_CREDENTIALS='{"type":"service_account","project_id":"your-project-id","private_key_id":"your-private-key-id","private_key":"-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com","client_id":"your-client-id","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs"}'

echo "Setting GOOGLE_DRIVE_PARENT_FOLDER..."
railway variables set GOOGLE_DRIVE_PARENT_FOLDER=1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6

echo ""
echo "=== Checking Variables ==="
railway variables

echo ""
echo "=== Deploying ==="
railway up

echo ""
echo "=== Deployment Complete ==="
echo "Check logs with: railway logs"
echo "Check status at: https://ds-gutachten-formular-production.up.railway.app/health"