# SDE Tekla AI Quotation Assistant (Front-End Only)

A lightweight web application that analyzes Tekla project requirements and generates an AI-assisted quotation estimate.

## Features

- Requirement text analysis using front-end heuristic rules.
- Optional requirements file upload (`.txt`, `.md`, `.csv`) with auto-analysis.
- Automatic suggestion/auto-fill for drawing count from uploaded requirement content.
- Quote estimation based on project type, timeline, drawing count, complexity, and revision risk.
- Optional service add-ons (connection design, clash review, BIM coordination, QA/QC).
- Pure HTML/CSS/JavaScript: no backend required.

## Run locally

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Run from GitHub (GitHub Pages)

1. Push this project to your GitHub repository.
2. Go to **Settings → Pages**.
3. Set **Source** to deploy from branch (e.g., `main`) and root (`/`).
4. Save and wait for deployment.
5. Open your generated GitHub Pages URL.

## Notes

- This is an estimation helper, not a final commercial quote engine.
- Uploaded file analysis is heuristic and keyword-based.
- Review generated numbers with your project lead or estimator before sharing with clients.
