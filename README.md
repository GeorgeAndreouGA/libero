# Libero Tips



A production-ready betting tips platform built with **NestJS + Fastify** (backend) and **Next.js** (frontend). The platform features multi-tier subscription packs, Stripe payment integration, Telegram bot integration for VIP communities, automated database backups, and bilingual support (English/Greek).

![License](https://img.shields.io/badge/License-Source%20Available-orange)
![Node](https://img.shields.io/badge/Node-18%2B-green)
![Docker](https://img.shields.io/badge/Docker-Required-blue)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Domain Configuration](#domain-configuration)
  - [Port Configuration](#port-configuration)
- [Nginx Configuration](#nginx-configuration)
  - [Admin Panel Security](#admin-panel-security)
- [Security Features](#security-features)
  - [Custom Captcha System](#custom-captcha-system)
  - [Account Lockout Protection](#account-lockout-protection)
  - [Security Event Logging](#security-event-logging)
- [Stripe Setup](#stripe-setup)
- [Gmail (SMTP) Setup](#gmail-smtp-setup)
- [Telegram Bot Setup](#telegram-bot-setup)
- [Database Backups](#database-backups)
  - [Local Backups](#local-backups)
  - [Google Drive Backups](#google-drive-backups)
- [Automated Tasks](#automated-tasks)
- [Deployment](#deployment)
- [Development](#development)
- [License](#license)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Multi-Tier Subscription Packs**: Free, VIP Silver, VIP Gold, VIP Elite with hierarchical access
- **Stripe Payments**: Secure checkout, subscription management, upgrade prorating, webhooks
- **Telegram Integration**: Automated VIP channel management, bot-based account linking, multi-language channels
- **Bilingual Support**: Full English and Greek translations (UI, emails, Telegram)
- **Admin Dashboard**: User management, bet creation, category/pack management, statistics
- **Automated Backups**: Commit-based and time-based SQL backups with Google Drive sync
- **Rate Limiting**: Nginx-level rate limiting for API protection
- **Email Notifications**: Verification, password reset, subscription confirmations, renewal reminders
- **Security**: JWT authentication, bcrypt password hashing, CSRF protection, security event logging, account lockout
- **Custom Captcha**: Privacy-focused math-based captcha with timing verification (no third-party dependencies)
- **Admin Panel Isolation**: Network-level separation of admin routes via dedicated port for VPN/internal access
- **Statistics Dashboard**: Track betting performance with win rates, profit/loss by category, and historical data
- **Automated Tasks**: Subscription expiry checks, renewal reminders, unverified account cleanup, security log cleanup

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Host Nginx (SSL Termination)                  │
│            Port 80/443 → localhost:8082 (Public)                 │
│   Port 857 (internal IP) → localhost:8083 (Admin - VPN only)     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Network (libero-prod)                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Nginx Container (Rate Limiting)                 │   │
│  │           Port 8082:80 (Public) / 8083:81 (Admin)         │   │
│  │     ┌─────────────┐          ┌─────────────┐             │   │
│  │     │   /api/*    │──────────│    /  /*    │             │   │
│  │     └──────┬──────┘          └──────┬──────┘             │   │
│  └────────────┼────────────────────────┼────────────────────┘   │
│               │                        │                         │
│               ▼                        ▼                         │
│  ┌────────────────────┐   ┌────────────────────┐                │
│  │   NestJS Backend   │   │  Next.js Frontend  │                │
│  │   (libero-app)     │   │  (libero-client)   │                │
│  │   Port 3005:3000   │   │   Port 3006:3001   │                │
│  └─────────┬──────────┘   └────────────────────┘                │
│            │                                                     │
│            ▼                                                     │
│  ┌────────────────────┐                                         │
│  │      MySQL 8.0     │                                         │
│  │   Port 3307:3306   │                                         │
│  └────────────────────┘                                         │
│                                                                  │
│  Docker Volumes:                                                 │
│  • libero-mysql-data-prod     (Database)                        │
│  • libero-uploads-data-prod   (User uploads)                    │
│  • libero-backups-data-prod   (SQL backups)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Docker** and **Docker Compose** v2+
- **Node.js** 18+ (for local development)
- **Nginx** on the host machine (for SSL termination)
- **Domain name** with DNS configured
- **SSL certificate** (Let's Encrypt recommended)
- **Stripe account** (for payments)
- **Gmail account** with App Password (for emails)
- **Telegram Bot** (for VIP channel management)

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/libero.git
cd libero
```

### 2. Configure Environment Variables

```bash
# Create root .env file
cp env.example .env

# Create symbolic link for server/.env (REQUIRED - must be same file)
ln -sf ../.env server/.env

# Create client environment file (for local development only)
# For Docker production builds, client vars come from root .env via build args
cp client/env.local.example client/.env.local
```

> **⚠️ Important**: 
> - The root `.env` and `server/.env` MUST be the same file (symbolic link)
> - For **Docker production**: Client variables are passed from root `.env` as build args - no `.env.local` needed
> - For **local development**: Create `client/.env.local` with the client variables

### 3. Configure Your Domain

Edit the following files with your domain (replace `yourdomain.com` with your actual domain):

| File | What to Update |
|------|----------------|
| **`.env`** (root) | `FRONTEND_URL`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, `TELEGRAM_WEBHOOK_URL` |
| **`client/.env.local`** | `NEXT_PUBLIC_API_URL` |
| **`nginx/conf.d/libero.conf`** | `server_name yourdomain.com;` |
| **Host nginx** | `server_name yourdomain.com;` and SSL cert paths |

> **Note**: `NEXT_PUBLIC_API_BASE_URL` should be left **blank** (empty string) - the client uses relative URLs.
>
> **Note**: `server/.env` is a symbolic link to root `.env`, so no separate changes needed there.

### 4. Start the Application

```bash
docker-compose up -d --build
```

### 5. Initialize the Database

After the containers are running, you need to set up the database in the correct order:

#### Step 1: Create Database & Secure Users
```bash
cd server
chmod +x setup-database.sh setup-schema-seed.sh setup-admin.sh
./setup-database.sh
```

This script creates:
- The database with UTF-8 support
- **App User** (`DB_USER`): Least-privilege user with only SELECT, INSERT, UPDATE, DELETE permissions
- **Read-Only User** (`DB_READONLY_USER`): For reporting/analytics with SELECT-only access

#### Step 2: Apply Schema & Seed Data
```bash
./setup-schema-seed.sh
```

This script:
- Drops all existing tables (safe for fresh installs)
- Applies the schema from `sql/schema-seed.sql`
- Seeds default categories, packs, and pack hierarchy

#### Step 3: Create Admin User
Add these to your `.env` first:
```bash
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecureAdminPassword123!
```

Then run:
```bash
./setup-admin.sh
```

> **Note**: For restoring from a backup, skip steps 2-3 and instead restore your backup SQL file (which includes all data including admin user).

### 6. Set Up SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# ===========================================
# APPLICATION
# ===========================================
NODE_ENV=production
TZ=Europe/Nicosia
APP_NAME=Libero Tips
SWAGGER_ENABLED=false

# ===========================================
# DATABASE
# ===========================================
DB_HOST=mysql
DB_PORT=3306
DB_NAME=libero_db
DB_USER=libero_app
DB_PASSWORD=your_secure_password
DB_ROOT_PASSWORD=your_root_password

# Read-only user for reporting (optional)
DB_READONLY_USER=libero_readonly
DB_READONLY_PASSWORD=your_readonly_password

# ===========================================
# JWT & SECURITY
# ===========================================
JWT_ACCESS_SECRET=your_32_char_min_access_secret_here
JWT_REFRESH_SECRET=your_32_char_min_refresh_secret_here
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
BCRYPT_ROUNDS=12
ENCRYPTION_KEY=your_32_char_encryption_key_here
COOKIE_SECRET=your_32_char_min_cookie_secret_here

# ===========================================
# URLS & CORS
# ===========================================
FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_API_BASE_URL=                          # Leave blank - uses relative URLs

# ===========================================
# EMAIL (Gmail SMTP)
# ===========================================
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=your_gmail_app_password
MAIL_FROM=noreply@yourdomain.com
CONTACT_EMAIL=contact@yourdomain.com

# ===========================================
# STRIPE
# ===========================================
STRIPE_API_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# ===========================================
# TELEGRAM
# ===========================================
TELEGRAM_BOT_TOKEN=123456:ABC-xxxxx
TELEGRAM_BOT_USERNAME=YourBotUsername
TELEGRAM_WEBHOOK_URL=https://yourdomain.com
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret

# English Channels
TELEGRAM_VIP_CHAT_ID=-100xxxxxxxxxx
TELEGRAM_PUBLIC_CHAT_ID=-100xxxxxxxxxx
TELEGRAM_VIP_COMMUNITY_CHAT_ID=-100xxxxxxxxxx

# Greek Channels
TELEGRAM_VIP_CHAT_ID_EL=-100xxxxxxxxxx
TELEGRAM_PUBLIC_CHAT_ID_EL=-100xxxxxxxxxx
TELEGRAM_VIP_COMMUNITY_CHAT_ID_EL=-100xxxxxxxxxx

# Public Links (for website display)
TELEGRAM_LINK=https://t.me/+xxxxx
TELEGRAM_LINK_EL=https://t.me/+xxxxx
TELEGRAM_LINK_PUBLIC=https://t.me/+xxxxx
TELEGRAM_LINK_PUBLIC_EL=https://t.me/+xxxxx
TELEGRAM_VIP_COMMUNITY_LINK=https://t.me/+xxxxx
TELEGRAM_VIP_COMMUNITY_LINK_EL=https://t.me/+xxxxx

# ===========================================
# BRANDING
# ===========================================
LOGO_URL=/branding/logo.png
FAVICON_URL=/branding/favicon.ico

# ===========================================
# SOCIAL LINKS
# ===========================================
INSTAGRAM_LINK=https://instagram.com/yourpage
INSTAGRAM_LINK_EL=https://instagram.com/yourpage_greek
TIKTOK_LINK=https://tiktok.com/@yourpage

# ===========================================
# ADMIN USER (for setup-admin.sh script)
# ===========================================
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YourSecureAdminPassword123!

# ===========================================
# LOGGING
# ===========================================
LOG_LEVEL=info
LOG_PRETTY=false
```

### Domain Configuration

To change your domain, update these locations:

| File | Variables to Update |
|------|---------------------|
| `.env` (root) | `FRONTEND_URL`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, `TELEGRAM_WEBHOOK_URL` |
| `server/.env` | Symbolic link to root `.env` (no changes needed) |
| `client/.env.local` | `NEXT_PUBLIC_API_URL` (leave `NEXT_PUBLIC_API_BASE_URL` blank) |
| `nginx/conf.d/libero.conf` | `server_name yourdomain.com;` |
| Host Nginx config | `server_name yourdomain.com;` |

> **Note**: `NEXT_PUBLIC_API_BASE_URL` should always be **blank** (empty) as the client uses relative URLs for API calls.

### Port Configuration

If you have port conflicts on your server, **only modify the host ports** in `docker-compose.yml`:

```yaml
services:
  mysql:
    ports:
      - "127.0.0.1:3307:3306"    # Change 3307 to another port if needed
  
  app:
    ports:
      - "127.0.0.1:3005:3000"   # Change 3005 if needed
  
  client:
    ports:
      - "127.0.0.1:3006:3001"   # Change 3006 if needed
  
  nginx:
    ports:
      - "127.0.0.1:8082:80"     # Public routes (update host nginx too)
      - "127.0.0.1:8083:81"     # Admin routes (VPN/internal only)
```

> **Note**: Container ports (right side of `:`) should NOT be changed. Only modify host ports (left side).

**Port Summary:**

| Host Port | Container Port | Purpose |
|-----------|----------------|---------|
| 3307 | 3306 | MySQL database |
| 3005 | 3000 | NestJS backend (internal) |
| 3006 | 3001 | Next.js frontend (internal) |
| 8082 | 80 | Nginx public routes |
| 8083 | 81 | Nginx admin routes (restrict access!) |

---

## Nginx Configuration

The application uses a **two-proxy architecture**:

### Why Two Proxies?

1. **Host Nginx**: Handles SSL termination (Let's Encrypt certificates) and serves on ports 80/443 (public) and 857 (admin)
2. **Container Nginx**: Handles rate limiting, routing between services, security headers, and admin route isolation

This architecture provides:
- **Portability**: Host nginx handles SSL, so containers don't need certificate management
- **No port conflicts**: Container nginx runs on internal ports, not 80/443
- **Rate limiting isolation**: Rate limiting in container protects the app specifically
- **Easy certificate renewal**: Certbot manages certs on host without affecting containers
- **Admin isolation**: Admin panel runs on separate port, can be restricted to VPN/internal network
- **WebSocket handling**: Proper connection header handling for WebSocket vs HTTP requests
- **Mobile upload support**: Extended timeouts (120s) for admin API to handle slow mobile uploads

### Host Nginx Configuration

Create the host nginx configuration at `/etc/nginx/sites-available/libero`:

```bash
sudo nano /etc/nginx/sites-available/libero
```

See the full configuration in the [Admin Panel Security](#admin-panel-security) section below, which includes both the public (443) and admin (857) server blocks.

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/libero /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Container Nginx Rate Limits

The container nginx (`nginx/nginx.conf`) includes these rate limits:

| Zone | Rate | Burst | Endpoints |
|------|------|-------|-----------|
| `general_zone` | 10 req/s | 100 | Frontend, API general |
| `login_zone` | 20 req/min | 5 | `/api/auth/login`, `/api/auth/refresh` |
| `signup_zone` | 5 req/min | 3 | Signup, forgot/reset password, resend verification |
| `admin_zone` | 60 req/min | 20 | `/api/admin/*` (relaxed since admin is behind VPN) |

### Admin Panel Security

The application uses a **two-port architecture** to completely isolate the admin panel from public access:

| Port | Host Port | Purpose | Accessibility |
|------|-----------|---------|---------------|
| 80 | 8082 | Public routes | Internet (via SSL on 443) |
| 81 | 8083 | Admin routes | VPN/Internal only (port 857) |

**How it works:**
- **Port 443 (Public)**: Serves the public website. Any requests to `/admin` or `/api/admin/*` return 404, completely hiding the admin panel's existence.
- **Port 857 (Admin)**: Serves admin routes only. Protected by firewall rules and nginx IP allowlist.

**Requirements for Admin Access:**
1. **Firewall**: Port 857 should be blocked from the internet and only accessible via VPN/internal network
2. **IP Allowlist**: Configure allowed IPs in the nginx config (VPN ranges, internal network)
3. **VPN**: Use Tailscale, WireGuard, or OpenVPN for secure remote access

**Host Nginx Configuration:**

```nginx
# =============================================================================
# HTTP → HTTPS Redirect (Port 80)
# =============================================================================
server {
    listen 80;
    server_name yourdomain.com;

    # Let's Encrypt certificate renewal challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# =============================================================================
# Connection header handling for WebSocket vs regular HTTP
# =============================================================================
# This map ensures Connection header is only set to 'upgrade' for WebSocket
# requests, not for regular HTTP requests like file uploads
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      '';
}

# =============================================================================
# PUBLIC SERVER - Port 443 (Internet accessible)
# =============================================================================
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Allow larger file uploads
    client_max_body_size 5M;

    # Block admin routes - return 404 to hide existence
    location /admin {
        return 404;
    }
    
    location /api/admin {
        return 404;
    }

    # All other routes → Docker Nginx public port
    location / {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# =============================================================================
# ADMIN SERVER - Port 857 (VPN/Internal Network ONLY)
# =============================================================================
# This port should be BLOCKED from the internet via firewall
# Only accessible via VPN or from within the internal network
# Access URL: https://yourdomain.com:857/admin
# =============================================================================
server {
    listen 857 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Allow larger file uploads (for bet images)
    client_max_body_size 5M;

    # IP Allowlist - customize for your network
    # Common VPN subnets:
    #   OpenVPN default:    10.8.0.0/24
    #   WireGuard example:  10.200.200.0/24
    #   Tailscale:          100.64.0.0/10
    allow 192.168.0.0/16;      # Private network range
    allow 10.0.0.0/8;          # Private network range
    allow 100.64.0.0/10;       # Tailscale VPN range (CGNAT)
    deny all;

    location / {
        proxy_pass http://localhost:8083;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Extended timeouts for slow mobile connections uploading images
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        
        # Buffer settings for file uploads
        proxy_request_buffering on;
        proxy_buffering on;
    }
}
```

**Securing Admin Access:**

The admin panel on port 857 uses a combination of firewall rules and nginx IP allowlists:

1. **Firewall**: Block port 857 from the internet. Only allow access from your VPN/internal network.
   ```bash
   # UFW example - allow port 857 only from internal network
   sudo ufw allow from 192.168.0.0/16 to any port 857
   sudo ufw allow from 100.64.0.0/10 to any port 857  # Tailscale
   ```

2. **IP Allowlist**: Configure the `allow` directives in the nginx config to match your VPN/network ranges.

3. **VPN**: Use a VPN like Tailscale, WireGuard, or OpenVPN to access the admin panel securely from anywhere.

---

## Security Features

### Custom Captcha System

The application uses a **custom math-based captcha** instead of third-party services like reCAPTCHA or hCaptcha. This provides:

- **Privacy**: No data sent to third parties
- **No API keys needed**: Works offline, no external dependencies
- **Bot protection**: Math problems with timing verification

**How it works:**
1. User is presented with a simple math problem (e.g., `12 + 7 = ?`)
2. User solves the problem and submits
3. Backend verifies:
   - Correct answer
   - Minimum solve time (2+ seconds - bots solve too fast)
   - Token hasn't been reused (replay protection)
   - Token hasn't expired (5 minute validity)

The captcha is used on:
- User registration (signup)
- Password reset requests
- Other sensitive operations

### Account Lockout Protection

The security system automatically locks accounts after too many failed login attempts:

| Setting | Value |
|---------|-------|
| Max failed attempts | 5 |
| Lockout duration | 15 minutes |
| Attempt window | 15 minutes |

**Lockout applies to:**
- IP address (prevents distributed attacks)
- Username/email (prevents targeted attacks)

After lockout, users see a message with remaining lockout time.

### Security Event Logging

All security-related events are logged to the `security_events` table:

| Event Type | Description |
|------------|-------------|
| `LOGIN_SUCCESS` | Successful login |
| `LOGIN_FAILED` | Failed login attempt |
| `LOGOUT` | User logout |
| `PASSWORD_CHANGE` | Password changed by user |
| `PASSWORD_RESET` | Password reset via email |
| `ACCOUNT_LOCKED` | Account locked due to failed attempts |
| `ACCOUNT_UNLOCKED` | Account unlocked (lockout expired) |
| `ADMIN_ACTION` | Admin performed action (with details) |

**Log retention:**
- Logs are automatically cleaned up after **90 days**
- Cleanup runs daily
- Admin actions are preserved for audit trail

**Viewing security events:**
Security events can be viewed per user in the admin dashboard, showing IP addresses, user agents, and action details.

---

## Stripe Setup

### 1. Create Stripe Account

1. Go to [stripe.com](https://stripe.com) and create an account
2. Complete business verification for live payments

### 2. Get API Keys

1. Go to **Developers → API Keys**
2. Copy your **Publishable key** (`pk_live_...`) and **Secret key** (`sk_live_...`)
3. Add to your `.env`:
   ```bash
   STRIPE_API_KEY=sk_live_xxxxx
   STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
   ```

### 3. Configure Webhook

1. Go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `charge.failed`
   - `charge.refunded`
   - `charge.dispute.created`
5. Copy the **Signing secret** (`whsec_...`) and add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

### 4. Create Products (Optional)

Products are created automatically when you add packs in the admin dashboard. You can also create them manually in Stripe and link the Price IDs.

---

## Gmail (SMTP) Setup

The application uses Gmail SMTP for sending emails. You need to create an **App Password** (regular password won't work with 2FA).

### 1. Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

### 2. Create App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select **Mail** and **Other (Custom name)**
3. Enter "Libero Tips" and click **Generate**
4. Copy the 16-character password (without spaces)

### 3. Configure Environment

```bash
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your-email@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx  # App password (spaces are fine)
MAIL_FROM=noreply@yourdomain.com
```

> **Note**: `MAIL_FROM` can be different from `MAIL_USER`, but Gmail will show the actual sender email.

---

## Telegram Bot Setup

The Telegram bot manages VIP channel access automatically.

### 1. Create a Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Choose a name and username
4. Copy the **bot token** to your `.env`:
   ```bash
   TELEGRAM_BOT_TOKEN=123456:ABC-xxxxx
   TELEGRAM_BOT_USERNAME=YourBotUsername
   ```

### 2. Create Channels/Groups

Create the following channels/groups:
- **VIP Channel (EN)**: Private channel for English VIP tips
- **VIP Channel (EL)**: Private channel for Greek VIP tips
- **Public Channel (EN)**: Public channel for free tips
- **Public Channel (EL)**: Public channel for free tips (Greek)
- **VIP Community (EN)**: Private group for VIP member chat
- **VIP Community (EL)**: Private group for Greek VIP member chat

### 3. Get Chat IDs

1. Add your bot to each channel/group as an **admin**
2. Send a message in the channel
3. Visit: `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
4. Find the `chat.id` for each channel (format: `-100xxxxxxxxxx`)

### 4. Configure Environment

```bash
# English Channels
TELEGRAM_VIP_CHAT_ID=-100xxxxxxxxxx
TELEGRAM_PUBLIC_CHAT_ID=-100xxxxxxxxxx
TELEGRAM_VIP_COMMUNITY_CHAT_ID=-100xxxxxxxxxx

# Greek Channels
TELEGRAM_VIP_CHAT_ID_EL=-100xxxxxxxxxx
TELEGRAM_PUBLIC_CHAT_ID_EL=-100xxxxxxxxxx
TELEGRAM_VIP_COMMUNITY_CHAT_ID_EL=-100xxxxxxxxxx

# Webhook (auto-configured on startup)
TELEGRAM_WEBHOOK_URL=https://yourdomain.com
TELEGRAM_WEBHOOK_SECRET=your_random_secret_string
```

### 5. Bot Permissions

Ensure the bot has these permissions in all VIP channels/groups:
- **Invite Users via Link**
- **Ban Users**
- **Delete Messages** (optional)

---

## Database Backups

The application has a two-tier backup system:

### Local Backups

The backend automatically creates SQL backups:

| Type | Frequency | Location | Retention |
|------|-----------|----------|-----------|
| **Commit-based** | After each write operation | `/app/backups/commit/` | Last 5-10 backups |
| **Time-based** | Every 5 minutes | `/app/backups/time/` | Last 5-10 backups |

Backups are stored in the Docker volume `libero-backups-data-prod`.

### Google Drive Backups

For off-site backup redundancy, use the included `gdrive-backup.sh` script.

#### 1. Install rclone

```bash
# Option 1: Using apt
sudo apt update && sudo apt install rclone

# Option 2: Official script (latest version)
curl https://rclone.org/install.sh | sudo bash
```

#### 2. Configure rclone

```bash
rclone config
```

Follow the prompts:
1. `n` - New remote
2. Name: `gdrive`
3. Choose `drive` (Google Drive)
4. Leave client_id and client_secret blank
5. Scope: `1` (full access)
6. Complete OAuth flow

#### 3. Make Script Executable

```bash
chmod +x backup_scripts/gdrive-backup.sh
```

#### 4. Test the Script

```bash
# Test SQL backup
sudo ./backup_scripts/gdrive-backup.sh sql

# Test uploads backup
sudo ./backup_scripts/gdrive-backup.sh uploads

# Test both
sudo ./backup_scripts/gdrive-backup.sh all
```

#### 5. Set Up Cron Jobs

```bash
sudo crontab -e
```

Add:

```cron
# Libero SQL Backups - every 26 minutes
*/26 * * * * /home/user/libero/backup_scripts/gdrive-backup.sh sql >> /var/log/libero-gdrive-backup.log 2>&1

# Libero Photo Uploads - every 6 hours
0 */6 * * * /home/user/libero/backup_scripts/gdrive-backup.sh uploads >> /var/log/libero-gdrive-backup.log 2>&1
```

#### Backup Paths

| Data | Docker Volume Path | Google Drive Folder |
|------|-------------------|---------------------|
| SQL Backups | `/var/lib/docker/volumes/libero-backups-data-prod/_data` | `LiberoBackups/sql` |
| Photo Uploads | `/var/lib/docker/volumes/libero-uploads-data-prod/_data` | `LiberoBackups/uploads` |

---

## Automated Tasks

The backend runs several scheduled tasks automatically:

| Task | Frequency | Description |
|------|-----------|-------------|
| **Subscription Expiry Check** | Every hour | Marks expired subscriptions, kicks users from VIP Telegram, sends expiry emails |
| **Renewal Reminder** | Daily at midnight | Sends reminder emails 3 days before subscription expires |
| **Unverified Account Cleanup** | Every 6 hours | Deletes accounts that haven't verified email within 24 hours |
| **Security Log Cleanup** | Daily | Deletes security events older than 90 days |
| **Time-based Backup** | Every 5 minutes | Creates SQL backup to `/app/backups/time/` |
| **Commit-based Backup** | On data changes | Creates SQL backup after write operations |

These tasks run inside the NestJS application container and require no additional configuration.

---

## Deployment

### Production Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart containers
docker-compose down
docker-compose up -d --build

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f client
docker-compose logs -f nginx
```

### Database Migrations

The schema is managed via SQL files. To apply changes:

```bash
cd server
docker exec -i mysql-container mysql --default-character-set=utf8mb4 -u root -pYOUR_ROOT_PASSWORD libero_db < sql/migrations/your_migration.sql
```

> **Important**: Always use `--default-character-set=utf8mb4` when running SQL files to preserve Greek/Unicode characters.

### Restoring from Backup

If you need to restore from a backup (instead of fresh setup):

```bash
cd server

# Step 1: Create database & users (if not already done)
./setup-database.sh

# Step 2: Restore from your backup SQL file (replaces schema-seed + admin setup)
docker exec -i mysql-container mysql --default-character-set=utf8mb4 -u root -pYOUR_ROOT_PASSWORD libero_db < /path/to/your/backup.sql

# Step 3: Restore uploads folder (bet images)
# Copy your backed-up uploads to the Docker volume:
sudo cp -r /path/to/backup/uploads/* /var/lib/docker/volumes/libero-uploads-data-prod/_data/
```

> **Important**: When restoring, use the backup SQL file instead of `setup-schema-seed.sh` + `setup-admin.sh`. The backup already contains all data including the admin user.

### Health Checks

```bash
# Check all services are healthy
docker-compose ps

# Test API health (note: /health is at root, not /api/health)
curl https://yourdomain.com/health

# Test frontend
curl https://yourdomain.com/
```

---

## Development

### Local Development Setup

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Start MySQL (or use Docker)
docker-compose up -d mysql

# Start server in development mode
cd ../server
npm run start:dev

# Start client in development mode (new terminal)
cd ../client
npm run dev
```

### Useful Commands

```bash
# Server
npm run start:dev    # Development with hot reload
npm run build        # Build for production
npm run lint         # Run linter

# Client
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Run linter
```

### Swagger API Documentation

In development mode, Swagger documentation is available at:
```
http://localhost:3000/api/docs
```

To enable Swagger in production (not recommended), set in your `.env`:
```bash
SWAGGER_ENABLED=true
```

---

## License

This project is licensed under a **Source Available License with Contribution Rights**.

### What You CAN Do:
- ✅ View and study the source code
- ✅ Submit bug fixes and improvements via pull requests
- ✅ Learn from the codebase for educational purposes

### What You CANNOT Do:
- ❌ Use this code for commercial purposes
- ❌ Deploy this as your own service
- ❌ Sell or distribute this software
- ❌ Create competing products using this code
- ❌ Remove or alter copyright notices

See the [LICENSE](./LICENSE) file for full terms.

For licensing inquiries or permission requests, contact the project owner.

---

## Troubleshooting

### Common Issues

#### Containers won't start
```bash
# Check logs for errors
docker-compose logs -f

# Check if ports are in use
sudo lsof -i :3307
sudo lsof -i :8082
```

#### Database connection errors
```bash
# Verify MySQL is healthy
docker exec -it mysql-container mysqladmin ping -u root -p

# Check if schema was applied
docker exec -it mysql-container mysql -u root -p -e "SHOW TABLES;" libero_db
```

#### Email not sending
- Verify App Password is correct (16 characters, no spaces needed)
- Check if "Less secure apps" is not needed (App Passwords bypass this)
- Test SMTP connection:
```bash
docker exec -it libero-app-prod node -e "
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({host:'smtp.gmail.com',port:587,auth:{user:'YOUR_EMAIL',pass:'YOUR_APP_PASSWORD'}});
  t.verify().then(()=>console.log('SMTP OK')).catch(console.error);
"
```

#### Stripe webhooks not working
- Verify webhook URL is accessible from internet
- Check webhook signing secret matches
- View webhook logs in Stripe Dashboard → Developers → Webhooks

#### Telegram bot not responding
```bash
# Check webhook status
curl https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo

# Manually set webhook
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourdomain.com/api/webhooks/telegram"}'
```

#### Rate limiting too aggressive
Edit `nginx/nginx.conf` to adjust the rate limit zones, then rebuild:
```bash
docker-compose up -d --build nginx
```

#### Account locked out
If a user or admin is locked out due to failed login attempts:
```bash
# Check lockout status in the database
docker exec -it mysql-container mysql -u root -p -e "
  SELECT * FROM security_events 
  WHERE event_type = 'LOGIN_FAILED' 
  AND email_or_username = 'user@example.com'
  ORDER BY created_at DESC LIMIT 10;
" libero_db

# Wait 15 minutes for automatic unlock, or clear failed attempts manually:
docker exec -it mysql-container mysql -u root -p -e "
  DELETE FROM security_events 
  WHERE event_type = 'LOGIN_FAILED' 
  AND (email_or_username = 'user@example.com' OR ip_address = '1.2.3.4');
" libero_db
```

#### Captcha verification failing
- Ensure users are taking at least 2 seconds to solve the captcha
- Verify JavaScript is enabled in the browser
- Check that the form is submitting the captcha token correctly
- In development mode, the bypass token `development-bypass-token` can be used

#### Greek characters broken after restore
If Greek text (Ελληνικά) appears as `???` or garbled after restoring a backup:
1. **Always use UTF-8 when restoring**:
   ```bash
   docker exec -i mysql-container mysql --default-character-set=utf8mb4 -u root -pPASSWORD libero_db < backup.sql
   ```
2. **Check backup file encoding**: Ensure the backup SQL starts with:
   ```sql
   SET NAMES utf8mb4;
   SET CHARACTER SET utf8mb4;
   ```
3. **Verify database encoding**:
   ```bash
   docker exec -it mysql-container mysql -u root -p -e "
     SHOW VARIABLES LIKE 'character_set%';
     SHOW VARIABLES LIKE 'collation%';
   "
   ```
   All should show `utf8mb4` and `utf8mb4_unicode_ci`.

#### Admin panel not accessible
1. **Firewall**: Verify port 857 is open for your IP/network range:
   ```bash
   sudo ufw status | grep 857
   ```
2. **VPN Connection**: Ensure you're connected to VPN (Tailscale, WireGuard, etc.)
3. **IP Allowlist**: Check your IP is in the nginx allowlist (`allow x.x.x.x;`)
   - View your current IP: `curl ifconfig.me` or check Tailscale IP with `tailscale ip`
4. **Port Access**: Verify port 857 is accessible: `telnet yourdomain.com 857` or `nc -zv yourdomain.com 857`
5. **Nginx Config**: Verify host nginx is configured correctly: `sudo nginx -t`
6. **Container Running**: Check container nginx is running: `docker-compose logs nginx`

### Logs Location

| Service | Command |
|---------|---------|
| All services | `docker-compose logs -f` |
| Backend only | `docker-compose logs -f app` |
| Frontend only | `docker-compose logs -f client` |
| Nginx container | `docker-compose logs -f nginx` |
| MySQL | `docker-compose logs -f mysql` |
| Host nginx | `sudo tail -f /var/log/nginx/error.log` |
| Google Drive backup | `tail -f /var/log/libero-gdrive-backup.log` |

---

## Alternative: Single Nginx Configuration

If you prefer to handle SSL directly in the Docker container (without host nginx), you can modify the container nginx to:
1. Expose ports 80 and 443 directly
2. Mount SSL certificates into the container
3. Handle SSL termination in `nginx/conf.d/libero.conf`

**Note**: This is more complex for portability because:
- Ports 80/443 are often used by other services
- Certificate renewal requires container restart or volume mounts
- The two-proxy approach is recommended for most deployments

---

## Support

For issues and feature requests, please open an issue on GitHub.

---

**Built with ❤️ using NestJS, Next.js, and Docker**

