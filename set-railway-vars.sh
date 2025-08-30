#!/bin/bash

# Railway Environment Variables Setup Script
# Based on the screenshot showing suggested variables for ds-gutachten-formular

RAILWAY_TOKEN="f6b12df3-cde2-4daf-ab73-80d24b9cc64e"
SERVICE_ID="b7488db8-f4d4-4fe9-afe7-b21916a0c7b5"
GRAPHQL_URL="https://backboard.railway.app/graphql/v2"

echo "=== Setting Railway Environment Variables ==="
echo "Service ID: $SERVICE_ID"

# Function to set environment variable
set_var() {
    local name=$1
    local value=$2
    echo "Setting $name..."
    
    curl -X POST "$GRAPHQL_URL" \
        -H "Authorization: Bearer $RAILWAY_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"mutation { variableUpsert(input: { serviceId: \\\"$SERVICE_ID\\\", name: \\\"$name\\\", value: \\\"$value\\\" }) { id name value } }\"}" \
        -s | jq -r '.data.variableUpsert.name // .errors[0].message // "Error"'
}

# Set all required environment variables from screenshot
set_var "PORT" "3000"
set_var "NODE_ENV" "production"
set_var "NOTION_TOKEN" "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
set_var "KONTAKTE_DATABASE_ID" "25b5e4b84c4481d39e4fc8bbf27edf01"
set_var "BUSINESS_RESOURCES_DATABASE_ID" "25b5e4b84c448133ba41f551dd68717b"
set_var "GOOGLE_DRIVE_PARENT_FOLDER" "1GaAWZT6leiJoMh4rhpKDHr0NnvEKveF6"

# GOOGLE_CREDENTIALS would need to be set separately with the actual JSON
echo ""
echo "=== Environment Variables Set ==="
echo "Note: GOOGLE_CREDENTIALS needs to be set manually with the actual service account JSON"
echo ""
echo "To trigger a new deployment, push a change to the repository or use:"
echo "curl -X POST \"$GRAPHQL_URL\" \\"
echo "  -H \"Authorization: Bearer $RAILWAY_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"query\":\"mutation { serviceRedeploy(serviceId: \\\"'$SERVICE_ID'\\\") { id } }\"}'"