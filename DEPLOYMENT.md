# Deployment Guide - PrecisionLens Dashboard

## GitHub Pages Deployment

### Option 1: Deploy from `/web` directory (Recommended)

1. **Merge your branch to main**:
   ```bash
   git checkout main
   git merge claude/precision-lens-setup-011CUvASYBssN7ekg4GCqjYE
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Navigate to **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Branch: `main`
   - Folder: `/web`
   - Click **Save**

3. **Wait for deployment** (~2-3 minutes)
   - GitHub will automatically build and deploy
   - Your site will be available at: `https://jeromedubois pro.github.io/precision-lens/`

### Option 2: Deploy from root with custom workflow

If you want to deploy from root and have more control:

1. Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [ main ]

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Deploy to GitHub Pages
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./web
   ```

2. Commit and push the workflow file

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
