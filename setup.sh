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
NODE_ENV=production
PORT=3000
BASE_URL=http://localhost:3000
MODEL_URL=https://api.openai.com/v1
MODEL_API_KEY=your-model-api-key
# MODEL_PROVIDER=openai
# MODEL_WIRE_API=completions
EOF
    echo "✅ .env file created. Please update with your BYOK model endpoint and API key."
else
    echo "⚠️  .env file already exists. Skipping."
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your BYOK model endpoint and API key"
echo "2. Run: docker-compose build"
echo "3. Run: docker-compose up -d"
echo "4. Open the app and clone repositories from the UI (stored under ~/.copilot-sdk-demo/repos)"
