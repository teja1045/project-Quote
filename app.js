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

function extractByLabel(text, labels) {
  const labelExpr = labels.join('|');
  const pattern = new RegExp(`(?:${labelExpr})\\s*[:=-]\\s*([^\\n.,;]+)`, 'i');
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

function extractDrawingCountFromText(text) {
  const directPattern = /(\d{1,4})\s*(?:shop\s*)?(?:ga\s*)?(?:detail(?:ing)?\s*)?drawings?/gi;
  const sheetPattern = /(\d{1,4})\s*(?:sheets?|plans?)/gi;
  const matches = [];

  let match;
  while ((match = directPattern.exec(text)) !== null) matches.push(Number(match[1]));
  while ((match = sheetPattern.exec(text)) !== null) matches.push(Number(match[1]));

  return matches.length ? Math.max(...matches) : null;
}

function estimateDrawingCountFromScope(text) {
  const normalized = text.toLowerCase();
  let estimate = 30;
  const tokens = [
    ['stair', 4], ['seismic', 6], ['connection', 5], ['clash', 4], ['ifc', 3],
    ['bim', 3], ['fabrication', 8], ['industrial', 10], ['commercial', 7], ['platform', 4], ['truss', 5],
  ];

  for (const [token, score] of tokens) {
    if (normalized.includes(token)) estimate += score;
  }

  const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length;
  estimate += Math.min(sentenceCount * 2, 25);

  return Math.max(15, Math.min(estimate, 500));
}

function inferProjectType(text) {
  const normalized = text.toLowerCase();
  if (/industrial|plant|factory|process/.test(normalized)) return 'industrial';
  if (/residential|apartment|villa|housing/.test(normalized)) return 'residential';
  if (/infrastructure|bridge|metro|rail|airport/.test(normalized)) return 'infrastructure';
  return 'commercial';
}

function inferOptionalServices(text) {
  const normalized = text.toLowerCase();
  return {
    connectionDesign: /connection\s*design|connection\s*calc|seismic\s*design/.test(normalized),
    clashReview: /clash|navisworks|interference/.test(normalized),
    bimCoordination: /bim\s*coordination|coordination\s*meeting|ifc\s*coordination/.test(normalized),
    shopDrawingQc: /qa\/?qc|quality\s*check|shop\s*drawing\s*qc/.test(normalized),
  };
}

function inferComplexity(text) {
  const explicit = extractByLabel(text, ['complexity']);
  if (explicit) {
    const n = Number(explicit.match(/\d+/)?.[0]);
    if (n >= 1 && n <= 5) return n;
  }

  let score = 2;
  if (/seismic|complex|truss|heavy\s*industrial|retrofit/.test(text.toLowerCase())) score += 2;
  if (/ifc|clash|multi-discipline|coordination/.test(text.toLowerCase())) score += 1;
  return Math.min(5, Math.max(1, score));
}

function inferRevisionRisk(text) {
  const explicit = extractByLabel(text, ['risk', 'revision\s*risk']);
  if (explicit) {
    const n = Number(explicit.match(/\d+/)?.[0]);
    if (n >= 1 && n <= 5) return n;
  }

  let score = 2;
  if (/frequent\s*revision|tbd|to\s*be\s*confirmed|client\s*changes/.test(text.toLowerCase())) score += 2;
  if (/fast-track|urgent|compressed/.test(text.toLowerCase())) score += 1;
  return Math.min(5, Math.max(1, score));
}

function inferTimelineWeeks(text) {
  const labeled = extractByLabel(text, ['timeline', 'delivery\s*time', 'duration']);
  const candidate = labeled || text;
  const weeksMatch = candidate.match(/(\d{1,2})\s*(weeks?|wks?)/i);
  if (weeksMatch) return Math.max(1, Number(weeksMatch[1]));

  const daysMatch = candidate.match(/(\d{1,3})\s*days?/i);
  if (daysMatch) return Math.max(1, Math.ceil(Number(daysMatch[1]) / 7));

  return 8;
}

function inferClientName(text) {
  const labeled = extractByLabel(text, ['client\s*name', 'client', 'customer']);
  if (labeled) return labeled;

  const firstLine = text.split(/\n+/)[0]?.trim() || '';
  const fromProjectHeader = firstLine.match(/(?:project|proposal)\s*[:\-]\s*(.+)$/i);
  if (fromProjectHeader) return fromProjectHeader[1].trim();

  return null;
}

function analyzeRequirementsFile(text) {
  const cleaned = normalizeText(text);
  const detectedDrawingCount = extractDrawingCountFromText(cleaned);
  const suggestedDrawingCount = detectedDrawingCount ?? estimateDrawingCountFromScope(cleaned);
  const timeline = inferTimelineWeeks(cleaned);
  const complexity = inferComplexity(cleaned);
  const revisionRisk = inferRevisionRisk(cleaned);
  const projectType = inferProjectType(cleaned);
  const clientName = inferClientName(text);
  const optionalServices = inferOptionalServices(cleaned);

  const findings = [
    detectedDrawingCount
      ? `Detected drawing/sheet quantity: ${detectedDrawingCount}.`
      : `No explicit drawing count found. Estimated drawing count: ${suggestedDrawingCount}.`,
    `Detected delivery timeline: ${timeline} week(s).`,
    `Detected complexity: ${complexity}/5.`,
    `Detected revision risk: ${revisionRisk}/5.`,
    `Detected project type: ${projectType}.`,
  ];

  if (clientName) findings.push(`Detected client name: ${clientName}.`);

  return {
    cleaned,
    clientName,
    projectType,
    timeline,
    suggestedDrawingCount,
    complexity,
    revisionRisk,
    optionalServices,
    findings,
  };
}

async function extractTextFromPdf(file) {
  if (!window.pdfjsLib) throw new Error('PDF library not available');

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.js';

  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += ` ${pageText}`;
  }

  return fullText;
}

async function readRequirementsFile(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return extractTextFromPdf(file);
  return file.text();
}

function applyOptionalServices(optionalServices) {
  form.querySelectorAll('fieldset input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = Boolean(optionalServices[checkbox.value]);
  });
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

requirementsFileInput.addEventListener('change', async () => {
  const file = requirementsFileInput.files?.[0];
  if (!file) {
    selectedFile.textContent = 'No file selected.';
    fileAnalysis.textContent = 'No file analyzed yet.';
    return;
  }

  selectedFile.textContent = `Selected file: ${file.name}`;
  fileAnalysis.textContent = 'Analyzing file...';

  try {
    const text = await readRequirementsFile(file);
    const analysis = analyzeRequirementsFile(text);

    requirementsInput.value = analysis.cleaned;
    if (analysis.clientName) clientNameInput.value = analysis.clientName;
    projectTypeInput.value = analysis.projectType;
    timelineInput.value = analysis.timeline;
    drawingCountInput.value = analysis.suggestedDrawingCount;
    complexityInput.value = analysis.complexity;
    revisionRiskInput.value = analysis.revisionRisk;
    applyOptionalServices(analysis.optionalServices);

    fileAnalysis.innerHTML = `<strong>${file.name}</strong> analyzed.<br>${analysis.findings.join(' ')}`;
  } catch {
    fileAnalysis.textContent = 'Could not read file. For PDF, ensure internet access for PDF.js and try again.';
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
    clientName: clientNameInput.value.trim(),
    projectType: projectTypeInput.value,
    timeline: Number(timelineInput.value),
    drawingCount: Number(drawingCountInput.value),
    requirements: requirementsInput.value.trim(),
    complexity: Number(complexityInput.value),
    revisionRisk: Number(revisionRiskInput.value),
    services: checkedServices,
  };

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
});
