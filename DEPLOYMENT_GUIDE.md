# AutoCore Deployment Guide: GitHub Pages Workflow

This document outlines the systematic process for deploying updates to the [Dynamic-Docs Portfolio](https://yash-verma5.github.io/Dynamic-Docs/).

## 🚀 Systematic Deployment Steps

Follow these steps whenever you make changes to your portfolio:

### 1. **Commit Local Changes**
Save your work locally. The GitHub Action is configured to trigger ONLY on the `main` branch.
```bash
git add .
git commit -m "feat: [describe your change, e.g., added new blog post]"
```

### 2. **Pull Remote Updates (Critical)**
Since the deployment process or other edits might update the remote repository, always pull before pushing to avoid conflicts.
```bash
git pull origin main --rebase
```

### 3. **Push to Main**
The push action triggers the `.github/workflows/deploy.yml` pipeline.
```bash
git push origin main
```

### 4. **Monitor the Action**
Visit the [GitHub Actions Tab](https://github.com/yash-verma5/Dynamic-Docs/actions) to verify:
- The **"Build website"** step completes without errors.
- The **"Deploy to GitHub Pages"** step successfully updates the `gh-pages` branch.

### 5. **Verify the Live Site**
Changes typically take 1-2 minutes to propagate to the CDN.
- **URL:** [https://yash-verma5.github.io/Dynamic-Docs/](https://yash-verma5.github.io/Dynamic-Docs/)

---

## 🛠️ Maintenance & Troubleshooting

### **Broken Link Warnings**
The build is configured with `onBrokenLinks: 'warn'` in `docusaurus.config.js`. This prevents deployment failures from minor internal link issues. If the build fails, check the logs for fatal errors like missing dependencies or syntax errors.

### **Manual Build Test**
Before pushing, you can test the build locally to ensure everything is perfect:
```bash
npm run build
```

### **Premium Design Tokens**
Ensure your custom CSS at `src/css/custom.css` remains aligned with the **Red, Black, and Gold** theme.
- **Primary Red:** High-vibrancy accent.
- **Glassmorphism:** Use subtle blurs and border-opacity for that premium feel.
- **Favorite Number:** Highlight references to "5" using the gold gradient.

> [!IMPORTANT]
> **Never manually edit the `gh-pages` branch.** It is a managed branch for build artifacts only. All source changes MUST happen on `main`.
