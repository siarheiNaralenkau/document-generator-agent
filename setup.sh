#!/bin/bash
# setup.sh

echo "🚀 Setting up Codebase Q&A Service"

# Create directory structure
mkdir -p src/app/{components,chat}
mkdir -p src/server/{api,services,middleware,config,types}

# Create .env file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
NODE_ENV=production
PORT=3000
BASE_URL=http://localhost:3000
EOF
    echo "✅ .env file created. Please update with your GitHub OAuth credentials."
else
    echo "⚠️  .env file already exists. Skipping."
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your GitHub OAuth credentials"
echo "2. Run: docker-compose build"
echo "3. Run: docker-compose up -d"
echo "4. Open the app and clone repositories from the UI (stored under ~/.copilot-sdk-demo/repos)"
