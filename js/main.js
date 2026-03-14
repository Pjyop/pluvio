/* ── Normales climatiques Munich (moyennes mensuelles 1991–2021) ── */
const NMM   = [55,50,53,62,82,110,127,110,85,65,56,60];  // précipitations mm/mois
const NTMAX = [2,4,9,14,19,23,25,25,20,14,7,3];           // temp max °C
const NTMIN = [-4,-4,0,4,9,13,15,15,11,6,1,-3];           // temp min °C
const NSUN  = [2,3,5,6,7,8,8,7,5,4,2,2];                  // ensoleillement h/j

let pci=null, sci=null, tci=null, period=30;




async function fetchDays(n) {
    const end   = new Date(); end.setDate(end.getDate() - 1);
    const start = new Date(end); start.setDate(start.getDate() - n + 1);
    const fmt   = d => d.toISOString().split('T')[0];
    const url   = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=48.1351&longitude=11.5820`
      + `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,`
      + `precipitation_sum,snowfall_sum,sunshine_duration`
      + `&start_date=${fmt(start)}&end_date=${fmt(end)}&timezone=Europe/Berlin`;
    const { daily: d } = await (await fetch(url)).json();
    return d.time.map((t, i) => ({
      d:       new Date(t),
      mo:      new Date(t).getMonth(),
      precip:  d.precipitation_sum[i]   ?? 0,
      snow:    d.snowfall_sum[i]         ?? 0,
      tmax:    d.temperature_2m_max[i]   ?? null,
      tmin:    d.temperature_2m_min[i]   ?? null,
      tmean:   d.temperature_2m_mean[i]  ?? null,
      sun:     Math.round((d.sunshine_duration[i] ?? 0) / 3600 * 10) / 10,
      sunNorm: NSUN[new Date(t).getMonth()],
    }));
  }


function fmtDate(d) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function go(n) {
  period = n;
  document.querySelectorAll('.pb').forEach(b => b.classList.remove('active'));
  const map = { 7: '7 j', 30: '30 j', 90: '90 j', 365: '1 an' };
  document.querySelectorAll('.pb').forEach(b => {
    if (b.textContent === map[n]) b.classList.add('active');
  });
  render(n);
}

async function render(n) {
  const days  = await fetchDays(n);
  const start = days[0].d;
  const end   = days[days.length - 1].d;

  document.getElementById('dr').textContent =
    fmtDate(start) + ' – ' + fmtDate(end);

  /* ── Calculs statistiques ── */
  const totalP   = days.reduce((a, b) => a + (b.precip || 0), 0);
  const avgT     = days.reduce((a, b) => a + b.tmean, 0) / days.length;
  const avgSun   = days.reduce((a, b) => a + b.sun, 0) / days.length;
  const sunnyDays = days.filter(d => d.sun >= 6).length;
  const rainDays  = days.filter(d => d.precip >= 1).length;
  const normalP   = days.reduce((a, d) => a + NMM[d.mo] / 30, 0);
  const normalSun = days.reduce((a, d) => a + NSUN[d.mo], 0) / days.length;
  const vsP = Math.round((totalP / normalP - 1) * 100);
  const vsS = Math.round((avgSun / normalSun - 1) * 100);

  /* ── Métriques ── */
  document.getElementById('m1').textContent  = Math.round(totalP) + ' mm';
  document.getElementById('m1s').textContent = 'sur ' + n + ' jours';
  document.getElementById('m2').textContent  = avgT.toFixed(1) + ' °C';
  document.getElementById('m2s').textContent = 'moyenne journalière';
  document.getElementById('m5').textContent  = avgSun.toFixed(1) + ' h/j';
  document.getElementById('m5s').textContent = 'moyenne journalière';
  document.getElementById('m6').textContent  = sunnyDays + ' j';
  document.getElementById('m6s').textContent = '(≥ 6h de soleil)';

  /* ── Indicateurs ── */
  document.getElementById('a1').textContent = rainDays + ' j / ' + n;
  document.getElementById('a1b').style.width = Math.min(100, Math.round(rainDays / n * 100)) + '%';

  const vsPL = (vsP > 0 ? '+' : '') + vsP + '%';
  document.getElementById('a2').textContent = vsPL;
  const bcP = vsP > 15 ? 'b-up' : vsP < -15 ? 'b-dn' : 'b-ok';
  const btP = vsP > 15 ? 'Au-dessus de la normale' : vsP < -15 ? 'En-dessous de la normale' : 'Dans la normale';
  document.getElementById('a2b').innerHTML = `<span class="badge ${bcP}">${btP}</span>`;

  const vsSL = (vsS > 0 ? '+' : '') + vsS + '%';
  document.getElementById('a4').textContent = vsSL;
  const bcS = vsS > 15 ? 'b-up' : vsS < -15 ? 'b-dn' : 'b-ok';
  const btS = vsS > 15 ? 'Plus ensoleillé' : vsS < -15 ? 'Moins ensoleillé' : 'Dans la normale';
  document.getElementById('a4b').innerHTML = `<span class="badge ${bcS}">${btS}</span>`;

  let curDry = 0, maxDry = 0, cd = 0;
  days.forEach(d => {
    if (d.precip < 0.5) { curDry++; maxDry = Math.max(maxDry, curDry); }
    else curDry = 0;
  });
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].precip < 0.5) cd++; else break;
  }
  document.getElementById('a3').textContent  = cd + ' j actuels';
  document.getElementById('a3s').textContent = 'Max sur période : ' + maxDry + ' j';

  /* ── Labels axe X ── */
  const skip = n > 90 ? Math.ceil(n / 12) : n > 30 ? 3 : 1;
  const labels = days.map((d, i) => i % skip === 0 ? fmtDate(d.d) : '');

  const gridColor = 'rgba(136,135,128,0.12)';
  const tickStyle = { color: '#888780', font: { size: 11 } };

  /* ── Graphique précipitations ── */
  if (pci) pci.destroy();
  pci = new Chart(document.getElementById('pc'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Pluie',
          data: days.map(d => Math.round((d.precip - d.snow) * 10) / 10),
          backgroundColor: '#378ADD',
          stack: 'p',
        },
        {
          label: 'Neige',
          data: days.map(d => d.snow),
          backgroundColor: '#85B7EB',
          stack: 'p',
        },
        {
          label: 'Normale',
          data: days.map(d => Math.round(NMM[d.mo] / 30 * 10) / 10),
          type: 'line',
          borderColor: '#EF9F27',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(1) + ' mm' } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { ...tickStyle, maxRotation: 45 } },
        y: { grid: { color: gridColor }, ticks: tickStyle, title: { display: true, text: 'mm', color: '#888780', font: { size: 11 } } },
      },
    },
  });

  /* ── Graphique ensoleillement ── */
  if (sci) sci.destroy();
  sci = new Chart(document.getElementById('sc'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Soleil',
          data: days.map(d => d.sun),
          backgroundColor: '#EF9F27',
        },
        {
          label: 'Normale',
          data: days.map(d => d.sunNorm),
          type: 'line',
          borderColor: '#FAC775',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          order: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(1) + ' h' } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { ...tickStyle, maxRotation: 45 } },
        y: { grid: { color: gridColor }, ticks: tickStyle, min: 0, max: 14, title: { display: true, text: 'h', color: '#888780', font: { size: 11 } } },
      },
    },
  });

  /* ── Graphique températures ── */
  if (tci) tci.destroy();
  tci = new Chart(document.getElementById('tc'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Max', data: days.map(d => d.tmax), borderColor: '#E24B4A', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'Min', data: days.map(d => d.tmin), borderColor: '#378ADD', borderWidth: 1.5, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'Moy', data: days.map(d => d.tmean), borderColor: '#888780', borderWidth: 1, pointRadius: 0, tension: 0.3, borderDash: [4, 3], fill: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(1) + ' °C' } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { ...tickStyle, maxRotation: 45 } },
        y: { grid: { color: gridColor }, ticks: tickStyle, title: { display: true, text: '°C', color: '#888780', font: { size: 11 } } },
      },
    },
  });
}

render(30);
