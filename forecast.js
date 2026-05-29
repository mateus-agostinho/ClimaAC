// ========= utils =========
function getParams() {
  const p = new URLSearchParams(location.search);
  return {
    lat: parseFloat(p.get('lat')),
    lon: parseFloat(p.get('lon')),
    place: p.get('place') || 'Previsão'
  };
}
function fmtDiaISO(iso, options = { weekday: 'short', day: 'numeric' }) {
  try {
    const d = new Date(iso + "T12:00:00"); // evita fuso mudar o dia
    return d.toLocaleDateString('pt-BR', options);
  } catch { return iso; }
}
// reaproveita do app (mapa rápido para emoji)
function codeToEmoji(code) {
  if (code === 0) return "☀️";
  if ([1,2,3].includes(code)) return "⛅";
  if ([45,48].includes(code)) return "🌫️";
  if ([51,53,55,56,57].includes(code)) return "🌦️";
  if ([61,63,65,66,67].includes(code)) return "🌧️";
  if ([71,73,75,77].includes(code)) return "❄️";
  if ([80,81,82].includes(code)) return "🌦️";
  if ([85,86].includes(code)) return "🌨️";
  if (code === 95) return "⛈️";
  if ([96,99].includes(code)) return "🌩️";
  return "❓";
}

async function getForecast(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
    `&timezone=auto&timeformat=iso8601`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Falha ao obter previsão.');
  const data = await r.json();
  return data.daily;
}

// ========= UI auxiliar =========
function renderTiles(daily) {
  const root = document.getElementById('day-tiles');
  root.innerHTML = '';
  for (let i = 0; i < daily.time.length; i++) {
    const day = fmtDiaISO(daily.time[i]);
    const emoji = codeToEmoji(daily.weather_code[i]);
    const tmin = Math.round(daily.temperature_2m_min[i]);
    const tmax = Math.round(daily.temperature_2m_max[i]);
    const rain = daily.precipitation_sum[i] ?? 0;

    const el = document.createElement('div');
    el.className = 'tile';
    el.innerHTML = `
      <div class="tile__day">${day}</div>
      <div class="tile__emoji">${emoji}</div>
      <div class="tile__temp">${tmax}° / ${tmin}°</div>
      <div class="tile__rain">${rain} mm de chuva</div>
    `;
    root.appendChild(el);
  }
}

// ========= Chart.js (gráfico legível) =========
function drawChart(labels, tmax, tmin, rain) {
  const ctx = document.getElementById('forecastChart').getContext('2d');

  // estilo geral mais legível
  Chart.defaults.font.size = 13;
  Chart.defaults.color = '#cbd5e1'; // cinza claro do tema

  return new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'Máx (°C)',
          data: tmax,
          yAxisID: 'yTemp',
          cubicInterpolationMode: 'monotone',
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3
        },
        {
          type: 'line',
          label: 'Mín (°C)',
          data: tmin,
          yAxisID: 'yTemp',
          cubicInterpolationMode: 'monotone',
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderDash: [4,4],
          borderWidth: 2
        },
        {
          type: 'bar',
          label: 'Chuva (mm)',
          data: rain,
          yAxisID: 'yRain',
          borderWidth: 0,
          borderRadius: 6,
          maxBarThickness: 18,
          // barras discretas para não “poluir”
          backgroundColor: 'rgba(147, 197, 253, 0.45)'
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true },
        datalabels: {
          // mostra números acima dos pontos das linhas (ex.: 33°)
          display: (ctx) => ctx.dataset.type === 'line',
          align: 'top',
          offset: 4,
          formatter: (v, ctx) => `${v}°`,
          color: '#e2e8f0',
          font: { weight: 600 }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const ds = context.dataset;
              const v = context.parsed.y;
              if (ds.type === 'bar') return ` Chuva: ${v} mm`;
              return ` ${ds.label.replace('(°C)','')}: ${v}°C`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true }
        },
        yTemp: {
          position: 'left',
          title: { display: true, text: '°C' },
          grid: { color: 'rgba(148,163,184,0.15)' }
        },
        yRain: {
          position: 'right',
          title: { display: true, text: 'mm' },
          grid: { display: false },
          suggestedMax: Math.max(10, Math.ceil(Math.max(...rain) * 1.2))
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}

// ========= main =========
(async function main(){
  const { lat, lon, place } = getParams();
  document.getElementById('place').textContent = `Previsão • ${place}`;
  document.getElementById('subtitle').textContent =
    'Linhas: temperaturas máx/mín (°C) • Barras: chuva acumulada (mm)';

  const daily = await getForecast(lat, lon);

  const labels = daily.time.map(d => fmtDiaISO(d)); // ex.: "qua, 2"
  const tmin   = daily.temperature_2m_min.map(v => Math.round(v));
  const tmax   = daily.temperature_2m_max.map(v => Math.round(v));
  const rain   = daily.precipitation_sum.map(v => v ?? 0);

  drawChart(labels, tmax, tmin, rain);
  renderTiles(daily);
})().catch(err => {
  console.error(err);
  alert('Erro ao carregar gráfico: ' + (err?.message || err));
});
