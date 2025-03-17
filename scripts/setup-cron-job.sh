#!/bin/bash

# This script sets up a daily cron job to standardize item names in the database

# Generate a random API key if not already set
if [ -z "$STANDARDIZATION_API_KEY" ]; then
  STANDARDIZATION_API_KEY=$(openssl rand -hex 16)
  echo "Generated new API key: $STANDARDIZATION_API_KEY"
  
  # Add to .env file if it exists
  if [ -f ".env" ]; then
    echo "Adding API key to .env file"
    echo "STANDARDIZATION_API_KEY=$STANDARDIZATION_API_KEY" >> .env
  else
    echo "No .env file found. Please add this key manually:"
    echo "STANDARDIZATION_API_KEY=$STANDARDIZATION_API_KEY"
  fi
fi

# Create the cron job script
CRON_SCRIPT="$HOME/standardize-items.sh"

cat > "$CRON_SCRIPT" << EOL
#!/bin/bash

# Script to call the standardize-items API endpoint
echo "Running item standardization at \$(date)"

# Set your application URL
APP_URL="https://your-app-url.com/api/standardize-items"

# Call the API with the authorization header
curl -X GET "\$APP_URL" \\
  -H "Authorization: Bearer $STANDARDIZATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -o /tmp/standardize-items-response.json

echo "Standardization complete. Response saved to /tmp/standardize-items-response.json"
EOL

# Make the script executable
chmod +x "$CRON_SCRIPT"

# Add to crontab to run daily at 3 AM
(crontab -l 2>/dev/null || echo "") | grep -v "$CRON_SCRIPT" | { cat; echo "0 3 * * * $CRON_SCRIPT >> $HOME/standardize-items.log 2>&1"; } | crontab -

echo "Cron job set up to run daily at 3 AM"
echo "Logs will be written to $HOME/standardize-items.log"
echo "You can edit the cron schedule with 'crontab -e'" 