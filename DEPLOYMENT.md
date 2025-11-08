# Deployment Guide - PrecisionLens Dashboard

## GitHub Pages Deployment (Automated via GitHub Actions)

### Setup Instructions

The repository is configured to automatically deploy the dashboard using GitHub Actions whenever you push to the `main` branch.

#### 1. Merge your changes to main

```bash
git checkout main
git merge claude/github-pages-source-config-011CUvRXsjkVUztLTkt4r6dK
git push origin main
```

#### 2. Configure GitHub Pages (One-time setup)

1. Go to your repository on GitHub: `https://github.com/JeromeDuboisPro/precision-lens`
2. Navigate to **Settings** → **Pages**
3. Under "Source", select **GitHub Actions**
4. The workflow will automatically deploy the `/web` directory

#### 3. Wait for deployment

- Go to the **Actions** tab to see the deployment progress
- First deployment takes ~2-3 minutes
- Subsequent deployments are faster (~1 minute)
- Your dashboard will be live at: `https://jeromedubois.github.io/precision-lens/`

### How it works

The `.github/workflows/deploy-pages.yml` workflow:
- Triggers automatically on every push to `main`
- Can also be triggered manually from the Actions tab
- Deploys only the `/web` directory contents
- Uses official GitHub Pages actions for reliability
- No build step needed (pure HTML/CSS/JS)

## Verifying Deployment

1. Check deployment status:
   - Go to **Actions** tab on GitHub
   - Look for "pages-build-deployment" workflow
   - Ensure it completed successfully

2. Test the dashboard:
   - Visit your GitHub Pages URL
   - Verify all traces load correctly
   - Test playback controls
   - Check responsive design on mobile

## Troubleshooting

### Issue: 404 errors for trace files

**Cause**: GitHub Pages may not serve JSON files correctly

**Fix**: Add `.nojekyll` file to web directory:
```bash
touch web/.nojekyll
git add web/.nojekyll
git commit -m "Add .nojekyll for GitHub Pages"
git push
```

### Issue: Slow loading

**Cause**: Large trace files (~2.5MB total)

**Fix**: Already optimized, but you can:
- Enable GitHub Pages CDN (automatic)
- Use GZIP compression (automatic on GitHub Pages)
- Consider lazy-loading traces

### Issue: CORS errors in local testing

**Cause**: Browsers block local file:// access

**Fix**: Always use a local server:
```bash
cd web
python3 -m http.server 8000
```

## LinkedIn Sharing

### Post Template

```
🚀 Built an interactive tool to visualize floating-point precision
tradeoffs in numerical algorithms.

Watch the power method algorithm converge across FP64, FP32, FP16,
and FP8 in real-time.

Key findings:
• FP8 achieves 70-80× speedup over FP64
• FP16 shows 20× speedup with <1% error (well-conditioned)
• FP32 is the sweet spot: 4-5× faster with negligible accuracy loss

Critical for understanding modern AI accelerators that leverage
reduced precision for massive throughput gains.

🔗 Live demo: https://jeromedubois pro.github.io/precision-lens/
📊 Built with: Plotly.js, Tailwind CSS, vanilla JavaScript
🎯 Fully interactive, no backend required

#MachineLearning #NumericalComputing #AI #PerformanceOptimization
#CUDA #GPU #DeepLearning
```

### Screenshot Tips

1. **Take screenshots at key moments**:
   - Initial state showing all 4 precision panels
   - Mid-animation with different convergence rates
   - Final comparison table with insights

2. **Use high-resolution**:
   - Browser at 1920×1080 or higher
   - Use browser dev tools to capture full page
   - Save as PNG for best quality

3. **Highlight key metrics**:
   - Circle the speedup numbers
   - Highlight the error comparison
   - Show the gauges in action

## Custom Domain (Optional)

If you have a custom domain:

1. Add `CNAME` file to web directory:
   ```bash
   echo "yourdomain.com" > web/CNAME
   ```

2. Configure DNS:
   - Add CNAME record pointing to `jeromedubois pro.github.io`
   - Wait for DNS propagation (~1 hour)

3. Update GitHub Pages settings to use custom domain

## Analytics (Optional)

Add Google Analytics to track visitors:

1. Get your GA tracking ID
2. Add to `web/index.html` before `</head>`:
   ```html
   <!-- Google Analytics -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'GA_TRACKING_ID');
   </script>
   ```

## Future Enhancements

- Add trace upload feature (drag-and-drop JSON)
- Implement live trace generation (Python → WebAssembly)
- Add more algorithms (Jacobi, Conjugate Gradient)
- Export comparison as PDF/PNG
- Add educational annotations/tutorials
- Integrate with Observable/Streamlit

## Support

Issues or questions? Open a GitHub issue or contact via LinkedIn.

---

**Ready to impress NVIDIA recruiters? Deploy and share on LinkedIn! 🚀**
