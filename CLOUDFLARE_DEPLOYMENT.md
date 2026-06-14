# Sazi TV - Cloudflare Pages Deployment Guide

This guide details how to build and deploy **Sazi TV** (React + Vite + TypeScript + Tailwind CSS v4) to Cloudflare Pages.

---

## 🏗️ 1. Project Specifications
* **Framework**: React (using Vite)
* **Build Engine**: Vite 6
* **Output Assets**: Compiled HTML, CSS, and JS files
* **Output Directory**: `dist` (all static bundles are output here upon `npm run build`)
* **Routing Support**: Full single-page application (SPA) fallback routing is handled by `/public/_redirects`

---

## ⚡ 2. Dashboard Deployment Configuration (Recommended)
To deploy your repository to Cloudflare Pages:

1. Log in to your **Cloudflare Dashboard** and select **Workers & Pages**.
2. Click **Create Application** -> Select the **Pages** tab -> Click **Connect to Git**.
3. Select your repository.
4. During the **Configure builds and deployments** step, apply these exact build settings:

### ⚙️ Correct Cloudflare Pages Settings
* **Framework preset**: `Vite` (or `None`)
* **Build command**: `npm run build`
* **Build output directory**: `dist`
* **Root directory**: *(Leave entirely empty)*

---

## 📂 3. Single-Page Application (SPA) Routing Fallback
We have added a custom `_redirects` routing configuration file at `/public/_redirects`. 

Vite auto-bundles this file into the root of `dist/` as `_redirects`. Cloudflare Pages reads this file upon deployment to map all deep paths (e.g., `/favorites`, `/settings`) back to `/index.html`, allowing React Router to manage state and routes seamlessly on the client side without throwing `404 Not Found` errors.

### Content of `_redirects`:
```text
/*    /index.html   200
```

---

## 💻 4. Local Build Verification
Before deploying, you can verify your build outputs locally by running:

```bash
# Install dependencies
npm install

# Compile production assets
npm run build
```

This will run Vite and compile all typescript, styles, and assets into the `/dist` directory. Verify that `dist/index.html` and `dist/_redirects` are generated cleanly.
