const form = document.getElementById('quote-form');
const resultCard = document.getElementById('result-card');
const requirementsInput = document.getElementById('requirements');
const drawingCountInput = document.getElementById('drawingCount');
const requirementsFileInput = document.getElementById('requirementsFile');
const fileAnalysis = document.getElementById('fileAnalysis');
const selectedFile = document.getElementById('selectedFile');
const clearFileBtn = document.getElementById('clearFileBtn');

const projectTypeMultiplier = {
  commercial: 1.15,
  industrial: 1.3,
  residential: 0.95,
  infrastructure: 1.4,
};

const servicePricing = {
  connectionDesign: 1200,
  clashReview: 700,
  bimCoordination: 500,
  shopDrawingQc: 650,
};

function currency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function extractDrawingCountFromText(text) {
  const directPattern = /(\d{1,4})\s*(?:shop\s*)?(?:ga\s*)?(?:detail(?:ing)?\s*)?drawings?/gi;
  const sheetPattern = /(\d{1,4})\s*(?:sheets?|plans?)/gi;
  const matches = [];

  let match;
  while ((match = directPattern.exec(text)) !== null) {
    matches.push(Number(match[1]));
  }
  while ((match = sheetPattern.exec(text)) !== null) {
    matches.push(Number(match[1]));
  }

  return matches.length ? Math.max(...matches) : null;
}

function estimateDrawingCountFromScope(text) {
  const normalized = text.toLowerCase();
  let estimate = 30;

  const complexityTokens = [
    ['stair', 4],
    ['seismic', 6],
    ['connection', 5],
    ['clash', 4],
    ['ifc', 3],
    ['bim', 3],
    ['fabrication', 8],
    ['industrial', 10],
    ['commercial', 7],
    ['platform', 4],
    ['truss', 5],
  ];

  for (const [token, score] of complexityTokens) {
    if (normalized.includes(token)) {
      estimate += score;
    }
  }

  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  estimate += Math.min(sentenceCount * 2, 25);

  return Math.max(15, Math.min(estimate, 500));
}

function analyzeRequirementsFile(text) {
  const cleaned = normalizeText(text);
  const detected = extractDrawingCountFromText(cleaned);
  const estimatedFromScope = estimateDrawingCountFromScope(cleaned);
  const finalSuggested = detected ?? estimatedFromScope;

  const findings = [];
  if (detected) {
    findings.push(`Detected explicit drawing/sheet quantity: ${detected}.`);
  } else {
    findings.push(`No explicit drawing count detected. Suggested estimate: ${estimatedFromScope}.`);
  }

  if (/ifc|coordination|clash|bim/i.test(cleaned)) {
    findings.push('Coordination/BIM scope detected.');
  }
  if (/connection|seismic|design/i.test(cleaned)) {
    findings.push('Engineering-sensitive scope detected.');
  }

  return {
    cleaned,
    suggestedDrawingCount: finalSuggested,
    findings,
  };
}

function buildRecommendation({ timeline, complexity, revisionRisk, requirements }) {
  const notes = [];

  if (timeline <= 4) {
    notes.push('Compressed timeline detected: include fast-track surcharge and staged deliverables.');
  }
  if (complexity >= 4) {
    notes.push('High complexity: allocate senior Tekla modeler hours for early model health checks.');
  }
  if (revisionRisk >= 4) {
    notes.push('High revision risk: add revision buffer in proposal terms and assumptions.');
  }
  if (/ifc|coordination|clash|bim/i.test(requirements)) {
    notes.push('Coordination-related scope found: schedule recurring coordination checkpoints.');
  }
  if (/connection|design|seismic/i.test(requirements)) {
    notes.push('Engineering-sensitive scope found: validate design responsibility boundaries clearly.');
  }

  if (!notes.length) {
    notes.push('Scope appears standard: proceed with baseline Tekla detailing package and one revision cycle.');
  }

  return notes;
}

function generateQuote(data) {
  const basePerDrawing = 85;
  const timelineFactor = data.timeline <= 4 ? 1.25 : data.timeline <= 8 ? 1.1 : 1;
  const complexityFactor = 0.85 + data.complexity * 0.12;
  const revisionFactor = 0.9 + data.revisionRisk * 0.08;
  const typeFactor = projectTypeMultiplier[data.projectType] ?? 1;

  const baseCost = data.drawingCount * basePerDrawing;
  const optionsCost = data.services.reduce((sum, key) => sum + (servicePricing[key] ?? 0), 0);

  const subtotal = baseCost * timelineFactor * complexityFactor * revisionFactor * typeFactor;
  const estimated = Math.round(subtotal + optionsCost);
  const contingency = Math.round(estimated * 0.1);
  const recommendedQuote = estimated + contingency;

  const riskLevel = data.complexity + data.revisionRisk >= 7 ? 'High' : data.complexity + data.revisionRisk >= 5 ? 'Medium' : 'Low';

  return {
    estimated,
    contingency,
    recommendedQuote,
    riskLevel,
    recommendations: buildRecommendation(data),
  };
}

requirementsFileInput.addEventListener('change', async () => {
  const file = requirementsFileInput.files?.[0];
  if (!file) {
    selectedFile.textContent = 'No file selected.';
    fileAnalysis.textContent = 'No file analyzed yet.';
    return;
  }

  selectedFile.textContent = `Selected file: ${file.name}`;

  try {
    const text = await file.text();
    const analysis = analyzeRequirementsFile(text);

    if (!requirementsInput.value.trim()) {
      requirementsInput.value = analysis.cleaned;
    }

    drawingCountInput.value = analysis.suggestedDrawingCount;
    fileAnalysis.innerHTML = `<strong>${file.name}</strong> analyzed.<br>${analysis.findings.join(' ')}`;
  } catch {
    fileAnalysis.textContent = 'Could not read file. Please upload a plain text-compatible file.';
  }
});

clearFileBtn.addEventListener('click', () => {
  requirementsFileInput.value = '';
  selectedFile.textContent = 'No file selected.';
  fileAnalysis.textContent = 'No file analyzed yet.';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const checkedServices = [...form.querySelectorAll('fieldset input:checked')].map((input) => input.value);

  const payload = {
    clientName: document.getElementById('clientName').value.trim(),
    projectType: document.getElementById('projectType').value,
    timeline: Number(document.getElementById('timeline').value),
    drawingCount: Number(drawingCountInput.value),
    requirements: requirementsInput.value.trim(),
    complexity: Number(document.getElementById('complexity').value),
    revisionRisk: Number(document.getElementById('revisionRisk').value),
    services: checkedServices,
  };

  const analysis = generateQuote(payload);
  const riskBadgeClass = analysis.riskLevel === 'Low' ? 'ok' : 'warn';

  resultCard.innerHTML = `
    <h2>Quotation Result</h2>
    <p><strong>Client:</strong> ${payload.clientName}</p>
    <div class="summary">
      <div class="metric">
        <strong>Estimated Cost</strong>
        <span>${currency(analysis.estimated)}</span>
      </div>
      <div class="metric">
        <strong>Contingency (10%)</strong>
        <span>${currency(analysis.contingency)}</span>
      </div>
      <div class="metric">
        <strong>Recommended Quote</strong>
        <span>${currency(analysis.recommendedQuote)}</span>
      </div>
      <div class="metric">
        <strong>Risk Level</strong>
        <span class="badge ${riskBadgeClass}">${analysis.riskLevel}</span>
      </div>
    </div>

    <h3>AI-style Scope Recommendations</h3>
    <pre>${analysis.recommendations.map((n, i) => `${i + 1}. ${n}`).join('\n')}</pre>

    <h3>Assumptions</h3>
    <ul>
      <li>Pricing model is heuristic and front-end only (no backend calculation).</li>
      <li>Base detailing rate used: ${currency(85)} per drawing before adjustment factors.</li>
      <li>Human review is required before client submission.</li>
    </ul>
  `;
});
