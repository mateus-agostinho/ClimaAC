// ==========================
// ELEMENTOS
// ==========================
const form     = document.querySelector('#search-form');
const input    = document.querySelector('#search-input');
const statusEl = document.querySelector('#status');

// HERO (local atual)
const heroCity = document.getElementById('hero-city');
const heroCond = document.getElementById('hero-cond');
const heroTemp = document.getElementById('hero-temp');
const heroMin  = document.getElementById('hero-min');
const heroMax  = document.getElementById('hero-max');
const heroHum  = document.getElementById('hero-humidity');
const heroWnd  = document.getElementById('hero-wind');

// Card de busca (opcional)
const card    = document.querySelector('#weather-card');
const cityEl  = document.querySelector('#city-name');
const tempEl  = document.querySelector('#temp');
const descEl  = document.querySelector('#desc');
const extraEl = document.querySelector('#extra');
const iconEl  = document.querySelector('#weather-icon'); // <img>

// “Previsão de hoje”
const todayCard      = document.getElementById('today-card');
const todaySummaryEl = document.getElementById('today-summary');

// fallback emoji
let emojiEl = document.querySelector('#weather-emoji');
if (!emojiEl) {
  emojiEl = document.createElement('span');
  emojiEl.id = 'weather-emoji';
  emojiEl.style.fontSize = '40px';
  emojiEl.style.display = 'none';
  if (iconEl && iconEl.parentNode) iconEl.parentNode.insertBefore(emojiEl, iconEl.nextSibling);
}

// guarda último local (para gráfico)
let lastPlace = null; // { display, lat, lon }

// ==========================
// HELPERS
// ==========================
const setStatus = (msg) => (statusEl.textContent = msg);

const hideCard = () => {
  if (card) {
    card.classList.add('card--hidden');
    card.setAttribute('aria-hidden', 'true');
  }
  if (todayCard) todayCard.style.display = 'none';
};

const showCard = () => {
  if (card) {
    card.classList.remove('card--hidden');
    card.setAttribute('aria-hidden', 'false');
  }
};

function codeToPtBr(code) {
  if (code === 0) return 'Céu limpo';
  if ([1,2,3].includes(code)) return 'Parcialmente nublado';
  if ([45,48].includes(code)) return 'Nevoeiro';
  if ([51,53,55,56,57].includes(code)) return 'Garoa';
  if ([61,63,65,66,67].includes(code)) return 'Chuva';
  if ([71,73,75,77].includes(code)) return 'Neve';
  if ([80,81,82].includes(code)) return 'Pancadas de chuva';
  if ([85,86].includes(code)) return 'Pancadas de neve';
  if (code === 95) return 'Trovoadas';
  if ([96,99].includes(code)) return 'Trovoadas com granizo';
  return 'Condição desconhecida';
}

function codeToIcon(code) {
  if (code === 0) return "https://open-meteo.com/images/weather-icons/clear-day.png";
  if ([1,2,3].includes(code)) return "https://open-meteo.com/images/weather-icons/partly-cloudy-day.png";
  if ([45,48].includes(code)) return "https://open-meteo.com/images/weather-icons/fog.png";
  if ([51,53,55,56,57].includes(code)) return "https://open-meteo.com/images/weather-icons/drizzle.png";
  if ([61,63,65,66,67].includes(code)) return "https://open-meteo.com/images/weather-icons/rain.png";
  if ([71,73,75,77].includes(code)) return "https://open-meteo.com/images/weather-icons/snow.png";
  if ([80,81,82].includes(code)) return "https://open-meteo.com/images/weather-icons/showers.png";
  if ([85,86].includes(code)) return "https://open-meteo.com/images/weather-icons/snow-showers.png";
  if (code === 95) return "https://open-meteo.com/images/weather-icons/thunderstorm.png";
  if ([96,99].includes(code)) return "https://open-meteo.com/images/weather-icons/thunderstorm-hail.png";
  return "https://open-meteo.com/images/weather-icons/unknown.png";
}

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

function fmtDiaISO(iso) {
  try { const d = new Date(iso + "T12:00:00"); return d.toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'}); }
  catch { return iso; }
}


// APIS

async function geocode(nome) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(nome)}&count=1&language=pt&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Falha ao localizar cidade.');
  const data = await r.json();
  if (!data.results?.length) throw new Error('Cidade não encontrada.');
  const { name, country, admin1, latitude, longitude } = data.results[0];
  return { display: [name, admin1, country].filter(Boolean).join(', '), lat: latitude, lon: longitude };
}

async function reverseGeocode(lat, lon) {
  const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=pt&format=json`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const data = await r.json();
  const first = data?.results?.[0];
  if (!first) return null;
  const { name, admin1, country } = first;
  return [name, admin1, country].filter(Boolean).join(', ');
}

async function getCurrent(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Falha ao obter clima atual.');
  const { current } = await r.json();
  if (!current) throw new Error('Sem dados de clima.');
  return { temp: current.temperature_2m, humidity: current.relative_humidity_2m, wind: current.wind_speed_10m, code: current.weather_code };
}

async function getDaily(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&timeformat=iso8601`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('Falha ao obter previsão.');
  const data = await r.json();
  return data.daily;
}


// RENDER

function renderHero(place, current, daily) {
  if (heroCity) heroCity.textContent = place;
  if (heroCond) heroCond.textContent = codeToPtBr(current.code);
  if (heroTemp) heroTemp.textContent = `${Math.round(current.temp)}°`;
  if (heroHum)  heroHum.textContent  = `Umidade: ${current.humidity}%`;
  if (heroWnd)  heroWnd.textContent  = `Vento: ${current.wind} km/h`;

  if (daily?.temperature_2m_min?.length) {
    if (heroMin) heroMin.textContent = Math.round(daily.temperature_2m_min[0]) + '°';
    if (heroMax) heroMax.textContent = Math.round(daily.temperature_2m_max[0]) + '°';
  }
}

function fillCard(place, weather) {
  if (!card) return;
  cityEl.textContent = place;
  tempEl.textContent = `${Math.round(weather.temp)}°C`;
  descEl.textContent = codeToPtBr(weather.code);
  extraEl.textContent = `Umidade: ${weather.humidity}% • Vento: ${weather.wind} km/h`;

  emojiEl.style.display = 'none'; emojiEl.textContent = '';
  const url = codeToIcon(weather.code);
  if (iconEl) {
    iconEl.onload  = () => { iconEl.style.display='block'; emojiEl.style.display='none'; };
    iconEl.onerror = () => { iconEl.style.display='none';  emojiEl.textContent=codeToEmoji(weather.code); emojiEl.style.display='inline-block'; };
    iconEl.src = url; iconEl.alt = `Ícone: ${descEl.textContent}`;
  }
}

function fillToday(daily) {
  if (!todayCard || !todaySummaryEl || !daily?.time?.length) {
    if (todayCard) todayCard.style.display='none';
    return;
  }
  const i = 0;
  const dia  = fmtDiaISO(daily.time[i]);
  const tmin = Math.round(daily.temperature_2m_min[i]);
  const tmax = Math.round(daily.temperature_2m_max[i]);
  const rain = daily.precipitation_sum[i] ?? 0;
  const emoji= codeToEmoji(daily.weather_code[i]);

  todaySummaryEl.textContent = `${dia} • ${emoji}  Máx ${tmax}° / Mín ${tmin}° • Chuva: ${rain} mm`;
  todayCard.style.display = 'block';
}

function openForecastPage() {
  if (!lastPlace) return;
  const url = `forecast.html?lat=${encodeURIComponent(lastPlace.lat)}&lon=${encodeURIComponent(lastPlace.lon)}&place=${encodeURIComponent(lastPlace.display)}`;
  window.location.href = url;
}
todayCard?.addEventListener('click', openForecastPage);
todayCard?.addEventListener('keypress', (e)=>{ if (e.key==='Enter'||e.key===' ') openForecastPage(); });

// ==========================
// GEOLOCALIZAÇÃO
// ==========================
async function locateAndRender() {
  try {
    setStatus('Obtendo localização...');

    // 1) GPS
    let coords = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Geolocalização indisponível.'));
      navigator.geolocation.getCurrentPosition(
        (pos)=> resolve({lat: pos.coords.latitude, lon: pos.coords.longitude}),
        (err)=> reject(err),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    }).catch((e)=>{ console.log('geo error', e); return null; });

    // 2) Fallback por IP (ipapi)
    if (!coords) {
      try {
        const r = await fetch('https://ipapi.co/json/');
        if (r.ok) {
          const j = await r.json();
          if (j?.latitude && j?.longitude) coords = { lat: j.latitude, lon: j.longitude };
        }
      } catch(e){ console.log('ipapi error', e); }
    }

    // 3) Segundo fallback por IP (ipwho.is)
    if (!coords) {
      try {
        const r = await fetch('https://ipwho.is/');
        if (r.ok) {
          const j = await r.json();
          if (j?.success && j?.latitude && j?.longitude) coords = { lat: j.latitude, lon: j.longitude };
        }
      } catch(e){ console.log('ipwho error', e); }
    }

    if (!coords) throw new Error('Sem coordenadas (GPS/IP).');

    const placeName = await reverseGeocode(coords.lat, coords.lon) || 'Sua localização';
    lastPlace = { display: placeName, lat: coords.lat, lon: coords.lon };

    const [current, daily] = await Promise.all([
      getCurrent(coords.lat, coords.lon),
      getDaily(coords.lat, coords.lon)
    ]);

    renderHero(placeName, current, daily);
    fillToday(daily);
    setStatus('');
  } catch (e) {
    console.warn('locateAndRender fail:', e);
    setStatus('Não consegui obter sua localização. Use a busca acima.');
  }
}

// Exponha para o Android chamar após conceder permissão
window.locateAndRender = locateAndRender;

// ==========================
// SUBMIT (busca manual)
// ==========================
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = input.value.trim(); if (!q) return;

  setStatus('Buscando...');
  hideCard();

  try {
    const place = await geocode(q);
    lastPlace = place;

    const [weather, daily] = await Promise.all([
      getCurrent(place.lat, place.lon),
      getDaily(place.lat, place.lon)
    ]);

    fillCard(place.display, weather);
    fillToday(daily);
    showCard();
    setStatus('');
  } catch (err) {
    console.error(err);
    setStatus(err.message || 'Erro ao buscar dados.');
    if (iconEl) iconEl.style.display='none';
    if (emojiEl) emojiEl.style.display='none';
    if (todayCard) todayCard.style.display='none';
  }
});

// Inicializa ao abrir o app (primeira tentativa de GPS/IP)
locateAndRender();
