# Private MCP Server (HTTP/SSE)

A secure Model Context Protocol (MCP) server with HTTP/SSE transport for connecting to Claude.ai.

## Features

This MCP server provides three example tools:

1. **get_current_time** - Get the current date and time (with optional timezone)
2. **calculate** - Perform basic mathematical calculations
3. **echo** - Echo back a message with optional uppercase formatting

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure your API key:
```bash
cp .env.example .env
# Edit .env and set a secure API_KEY
```

Generate a secure API key:
```bash
openssl rand -hex 32
```

3. Build the server:
```bash
npm run build
```

## Running the Server

### Local Development
```bash
npm start
```

The server will start on `http://localhost:3000` by default.

### Custom Port
```bash
PORT=8080 API_KEY=your-secure-key npm start
```

### Production Deployment (Railway.app)

For Claude.ai to connect, you need to deploy this server to a publicly accessible URL with HTTPS.

#### Step-by-Step Railway Deployment

1. **Create a Railway account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub (recommended for easy deployment)

2. **Initialize Git repository** (if not already done)
   ```bash
   cd mcp-server
   git init
   git add .
   git commit -m "Initial MCP server setup"
   ```

3. **Push to GitHub**
   - Create a new repository on GitHub
   - Push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

4. **Deploy on Railway**
   - Go to [railway.app/new](https://railway.app/new)
   - Click "Deploy from GitHub repo"
   - Select your MCP server repository
   - Railway will automatically detect the Node.js project

5. **Set Environment Variables**
   - In Railway dashboard, go to your project
   - Click on "Variables" tab
   - Add these variables:
     - `API_KEY`: Generate with `openssl rand -hex 32`
     - `PORT`: Railway sets this automatically, but you can override if needed

6. **Enable Public URL**
   - In Railway dashboard, go to "Settings"
   - Click "Generate Domain" to get a public HTTPS URL
   - Your server will be available at: `https://your-project.up.railway.app`

7. **Verify Deployment**
   ```bash
   curl https://your-project.up.railway.app/health
   ```

#### Alternative: Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set API_KEY=your-generated-key

# Deploy
railway up
```

## Connecting to Claude.ai

1. Go to [claude.ai](https://claude.ai)
2. Click on "Add custom connections" or look for MCP connector options
3. Add a new MCP connection with:
   - **URL**: `https://your-server-domain.com/sse`
   - **Authentication**: Bearer token
   - **API Key**: Your secure API key from the `.env` file

Example configuration:
```
URL: https://my-mcp-server.railway.app/sse
Auth Type: Bearer Token
Token: your-secret-api-key-from-env-file
```

## Testing the Server

Health check:
```bash
curl http://localhost:3000/health
```

Test authentication:
```bash
curl -H "Authorization: Bearer your-secret-api-key-change-this" \
     http://localhost:3000/sse
```

## Development

Watch mode for automatic recompilation:
```bash
npm run dev
```

## Example Usage

Once connected, you can use the tools through Claude:

- "What time is it in Tokyo?"
- "Calculate 123 * 456"
- "Echo 'hello world' in uppercase"

## Customization

To add your own tools:

1. Add tool definitions to the `TOOLS` array in [src/index.ts](src/index.ts)
2. Add corresponding case handlers in the `CallToolRequestSchema` handler
3. Rebuild the server with `npm run build`

## Learn More

- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP SDK on GitHub](https://github.com/modelcontextprotocol/typescript-sdk)
