const form = document.getElementById('quote-form');
const resultCard = document.getElementById('result-card');
const clientNameInput = document.getElementById('clientName');
const projectTypeInput = document.getElementById('projectType');
const timelineInput = document.getElementById('timeline');
const requirementsInput = document.getElementById('requirements');
const drawingCountInput = document.getElementById('drawingCount');
const complexityInput = document.getElementById('complexity');
const revisionRiskInput = document.getElementById('revisionRisk');
const requirementsFileInput = document.getElementById('requirementsFile');
const fileAnalysis = document.getElementById('fileAnalysis');
const selectedFile = document.getElementById('selectedFile');
const clearFileBtn = document.getElementById('clearFileBtn');


const DEFAULT_FORM_VALUES = {
  clientName: '',
  projectType: 'commercial',
  timeline: 8,
  drawingCount: 50,
  requirements: '',
  complexity: 3,
  revisionRisk: 2,
};

const DEFAULT_RESULT_HTML = `
  <h2>Quotation Result</h2>
  <p class="muted">Fill the form and click <em>Analyze & Generate Quote</em>.</p>
`;

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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function normalizeText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function extractByLabel(text, labels) {
  const pattern = new RegExp(`(?:^|[\\n\\r])\\s*(?:${labels.join('|')})\\s*[:=-]\\s*([^\\n\\r]+)`, 'im');
  return text.match(pattern)?.[1]?.trim() || null;
}

function extractDrawingCountFromText(text) {
  const patterns = [
    /(\d{1,4})\s*(?:shop\s*)?(?:ga\s*)?(?:detail(?:ing)?\s*)?drawings?/gi,
    /(\d{1,4})\s*(?:sheets?|plans?)/gi,
  ];

  const counts = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) counts.push(Number(match[1]));
  }

  return counts.length ? Math.max(...counts) : null;
}

function estimateDrawingCountFromScope(text) {
  const lower = text.toLowerCase();
  let estimate = 30;
  const tokens = [
    ['stair', 4], ['seismic', 6], ['connection', 5], ['clash', 4], ['ifc', 3],
    ['bim', 3], ['fabrication', 8], ['industrial', 10], ['commercial', 7], ['platform', 4], ['truss', 5],
  ];

  for (const [token, score] of tokens) {
    if (lower.includes(token)) estimate += score;
  }

  estimate += Math.min(text.split(/[.!?]+/).filter(Boolean).length * 2, 25);
  return Math.max(15, Math.min(estimate, 500));
}

function inferProjectType(text) {
  const lower = text.toLowerCase();
  if (/industrial|plant|factory|process/.test(lower)) return 'industrial';
  if (/residential|apartment|villa|housing/.test(lower)) return 'residential';
  if (/infrastructure|bridge|metro|rail|airport/.test(lower)) return 'infrastructure';
  return 'commercial';
}

function inferOptionalServices(text) {
  const lower = text.toLowerCase();
  return {
    connectionDesign: /connection\s*design|connection\s*calc|seismic\s*design/.test(lower),
    clashReview: /clash|navisworks|interference/.test(lower),
    bimCoordination: /bim\s*coordination|coordination\s*meeting|ifc\s*coordination/.test(lower),
    shopDrawingQc: /qa\/?qc|quality\s*check|shop\s*drawing\s*qc/.test(lower),
  };
}

function inferComplexity(text) {
  const explicit = Number(extractByLabel(text, ['complexity'])?.match(/\d+/)?.[0]);
  if (explicit >= 1 && explicit <= 5) return explicit;

  let score = 2;
  if (/seismic|complex|truss|heavy\s*industrial|retrofit/.test(text.toLowerCase())) score += 2;
  if (/ifc|clash|multi-discipline|coordination/.test(text.toLowerCase())) score += 1;
  return Math.max(1, Math.min(5, score));
}

function inferRevisionRisk(text) {
  const explicit = Number(extractByLabel(text, ['revision\s*risk', 'risk'])?.match(/\d+/)?.[0]);
  if (explicit >= 1 && explicit <= 5) return explicit;

  let score = 2;
  if (/frequent\s*revision|tbd|to\s*be\s*confirmed|client\s*changes/.test(text.toLowerCase())) score += 2;
  if (/fast-track|urgent|compressed/.test(text.toLowerCase())) score += 1;
  return Math.max(1, Math.min(5, score));
}

function inferTimelineWeeks(text) {
  const labeled = extractByLabel(text, ['timeline', 'delivery\s*time', 'duration']);
  const source = labeled || text;

  const weeks = source.match(/(\d{1,2})\s*(weeks?|wks?)/i);
  if (weeks) return Math.max(1, Number(weeks[1]));

  const days = source.match(/(\d{1,3})\s*days?/i);
  if (days) return Math.max(1, Math.ceil(Number(days[1]) / 7));

  return 8;
}

function inferClientName(text) {
  const labeled = extractByLabel(text, ['client\s*name', 'client', 'customer']);
  if (labeled) return labeled;

  const firstLine = text.split(/\n+/)[0]?.trim() || '';
  return firstLine.match(/(?:project|proposal)\s*[:\-]\s*(.+)$/i)?.[1]?.trim() || null;
}

function analyzeRequirementsText(rawText) {
  const cleaned = normalizeText(rawText);
  const explicitDrawingCount = extractDrawingCountFromText(rawText);
  const suggestedDrawingCount = explicitDrawingCount ?? estimateDrawingCountFromScope(cleaned);

  const analysis = {
    cleaned,
    clientName: inferClientName(rawText),
    projectType: inferProjectType(cleaned),
    timeline: inferTimelineWeeks(rawText),
    suggestedDrawingCount,
    complexity: inferComplexity(rawText),
    revisionRisk: inferRevisionRisk(rawText),
    optionalServices: inferOptionalServices(cleaned),
  };

  const findings = [
    explicitDrawingCount
      ? `Detected drawing/sheet quantity: ${explicitDrawingCount}.`
      : `No explicit drawing count found. Estimated drawing count: ${suggestedDrawingCount}.`,
    `Detected timeline: ${analysis.timeline} week(s).`,
    `Detected complexity: ${analysis.complexity}/5.`,
    `Detected revision risk: ${analysis.revisionRisk}/5.`,
    `Detected project type: ${analysis.projectType}.`,
    analysis.clientName ? `Detected client name: ${analysis.clientName}.` : 'Client name not clearly detected.',
  ];

  return { ...analysis, findings };
}


function filenameToClientName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureAutofillDefaults(partial, fileName) {
  const safeRequirements = partial.cleaned || 'Requirements inferred from uploaded file.';
  return {
    cleaned: safeRequirements,
    clientName: partial.clientName || filenameToClientName(fileName) || 'Uploaded File Client',
    projectType: partial.projectType || inferProjectType(safeRequirements),
    timeline: Number.isFinite(partial.timeline) && partial.timeline > 0 ? partial.timeline : 8,
    suggestedDrawingCount:
      Number.isFinite(partial.suggestedDrawingCount) && partial.suggestedDrawingCount > 0
        ? partial.suggestedDrawingCount
        : estimateDrawingCountFromScope(safeRequirements),
    complexity:
      Number.isFinite(partial.complexity) && partial.complexity >= 1 && partial.complexity <= 5
        ? partial.complexity
        : inferComplexity(safeRequirements),
    revisionRisk:
      Number.isFinite(partial.revisionRisk) && partial.revisionRisk >= 1 && partial.revisionRisk <= 5
        ? partial.revisionRisk
        : inferRevisionRisk(safeRequirements),
    optionalServices: partial.optionalServices || inferOptionalServices(safeRequirements),
    findings: partial.findings || [],
  };
}

async function extractTextFromPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js failed to load in browser.');
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.js';

  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageTexts = [];

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items || [];

    const linesByY = new Map();
    for (const item of items) {
      const y = Math.round(item.transform?.[5] || 0);
      if (!linesByY.has(y)) linesByY.set(y, []);
      linesByY.get(y).push(item.str);
    }

    const lines = [...linesByY.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.join(' ').trim())
      .filter(Boolean);

    pageTexts.push(lines.join('\n'));
  }

  const combinedText = pageTexts.join('\n\n').trim();
  if (!combinedText) {
    throw new Error('No readable text found in PDF. If this PDF is scanned/image-only, use OCR or upload text/csv/md/txt.');
  }

  return combinedText;
}

async function readRequirementsFile(file) {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    ? extractTextFromPdf(file)
    : file.text();
}

function applyOptionalServices(optionalServices) {
  form.querySelectorAll('fieldset input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = Boolean(optionalServices[checkbox.value]);
  });
}

function gatherPayload() {
  const services = [...form.querySelectorAll('fieldset input:checked')].map((input) => input.value);
  const requirements = requirementsInput.value.trim() || 'Requirements inferred from uploaded file.';
  const drawingCount = Number(drawingCountInput.value) || estimateDrawingCountFromScope(requirements);
  const timeline = Number(timelineInput.value) || inferTimelineWeeks(requirements);
  const complexity = Number(complexityInput.value) || inferComplexity(requirements);
  const revisionRisk = Number(revisionRiskInput.value) || inferRevisionRisk(requirements);
  const projectType = projectTypeInput.value || inferProjectType(requirements);

  return {
    clientName: clientNameInput.value.trim() || 'Uploaded File Client',
    projectType,
    timeline,
    drawingCount,
    requirements,
    complexity,
    revisionRisk,
    services,
  };
}

function buildRecommendation({ timeline, complexity, revisionRisk, requirements }) {
  const notes = [];
  if (timeline <= 4) notes.push('Compressed timeline detected: include fast-track surcharge and staged deliverables.');
  if (complexity >= 4) notes.push('High complexity: allocate senior Tekla modeler hours for early model health checks.');
  if (revisionRisk >= 4) notes.push('High revision risk: add revision buffer in proposal terms and assumptions.');
  if (/ifc|coordination|clash|bim/i.test(requirements)) notes.push('Coordination-related scope found: schedule recurring coordination checkpoints.');
  if (/connection|design|seismic/i.test(requirements)) notes.push('Engineering-sensitive scope found: validate design responsibility boundaries clearly.');
  if (!notes.length) notes.push('Scope appears standard: proceed with baseline Tekla detailing package and one revision cycle.');
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

  return {
    estimated,
    contingency,
    recommendedQuote: estimated + contingency,
    riskLevel: data.complexity + data.revisionRisk >= 7 ? 'High' : data.complexity + data.revisionRisk >= 5 ? 'Medium' : 'Low',
    recommendations: buildRecommendation(data),
  };
}

function renderQuote() {
  const payload = gatherPayload();
  const analysis = generateQuote(payload);
  const riskBadgeClass = analysis.riskLevel === 'Low' ? 'ok' : 'warn';

  resultCard.innerHTML = `
    <h2>Quotation Result</h2>
    <p><strong>Client:</strong> ${payload.clientName || 'N/A'}</p>
    <div class="summary">
      <div class="metric"><strong>Estimated Cost</strong><span>${currency(analysis.estimated)}</span></div>
      <div class="metric"><strong>Contingency (10%)</strong><span>${currency(analysis.contingency)}</span></div>
      <div class="metric"><strong>Recommended Quote</strong><span>${currency(analysis.recommendedQuote)}</span></div>
      <div class="metric"><strong>Risk Level</strong><span class="badge ${riskBadgeClass}">${analysis.riskLevel}</span></div>
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
}

requirementsFileInput.addEventListener('change', async () => {
  const file = requirementsFileInput.files?.[0];
  if (!file) {
    resetFormToDefaults();
    selectedFile.textContent = 'No file selected.';
    fileAnalysis.textContent = 'No file analyzed yet.';
    return;
  }

  selectedFile.textContent = `Selected file: ${file.name}`;
  fileAnalysis.textContent = 'Analyzing file and generating quote...';

  try {
    const text = await readRequirementsFile(file);
    const inferred = analyzeRequirementsText(text);
    const analysis = ensureAutofillDefaults(inferred, file.name);

    requirementsInput.value = analysis.cleaned;
    clientNameInput.value = analysis.clientName;
    projectTypeInput.value = analysis.projectType;
    timelineInput.value = analysis.timeline;
    drawingCountInput.value = analysis.suggestedDrawingCount;
    complexityInput.value = analysis.complexity;
    revisionRiskInput.value = analysis.revisionRisk;
    applyOptionalServices(analysis.optionalServices);

    fileAnalysis.innerHTML = `<strong>${file.name}</strong> analyzed.<br>${analysis.findings.join(' ')}`;
    renderQuote();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not analyze file.';
    fileAnalysis.textContent = `File analysis failed: ${message}`;
  }
});


function resetFormToDefaults() {
  form.reset();

  clientNameInput.value = DEFAULT_FORM_VALUES.clientName;
  projectTypeInput.value = DEFAULT_FORM_VALUES.projectType;
  timelineInput.value = DEFAULT_FORM_VALUES.timeline;
  drawingCountInput.value = DEFAULT_FORM_VALUES.drawingCount;
  requirementsInput.value = DEFAULT_FORM_VALUES.requirements;
  complexityInput.value = DEFAULT_FORM_VALUES.complexity;
  revisionRiskInput.value = DEFAULT_FORM_VALUES.revisionRisk;

  form.querySelectorAll('fieldset input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
  });

  resultCard.innerHTML = DEFAULT_RESULT_HTML;
}

function clearUploadedFileAndData() {
  requirementsFileInput.value = '';

  if (requirementsFileInput.value) {
    requirementsFileInput.type = 'text';
    requirementsFileInput.type = 'file';
  }

  selectedFile.textContent = 'No file selected.';
  fileAnalysis.textContent = 'No file analyzed yet.';
  resetFormToDefaults();
}

clearFileBtn.addEventListener('click', () => {
  clearUploadedFileAndData();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  renderQuote();
});
