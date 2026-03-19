#!/bin/bash
# setup.sh

echo "🚀 Setting up Codebase Q&A Service"

# Create directory structure
mkdir -p backend/src/{api,services,middleware,config,types}
mkdir -p frontend/app/{components,chat,api}
mkdir -p repos

# Create .env file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
GITHUB_CLIENT_ID=your_client_id_here
GITHUB_CLIENT_SECRET=your_client_secret_here
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
EOF
    echo "✅ .env file created. Please update with your GitHub OAuth credentials."
else
    echo "⚠️  .env file already exists. Skipping."
fi

# Create repos README
cat > repos/README.md << EOF
# Repositories Directory

Place your team's repositories here for the Q&A service to access.

## Example:
\`\`\`bash
cd repos
git clone https://github.com/yourorg/project-a
git clone https://github.com/yourorg/project-b
\`\`\`
EOF

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your GitHub OAuth credentials"
echo "2. Clone repositories into ./repos/"
echo "3. Run: docker-compose build"
echo "4. Run: docker-compose up -d"
