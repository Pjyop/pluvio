const express = require('express');
const axios = require('axios');
const { kv } = require('@vercel/kv');

const app = express();
const port = 3000;

app.use(express.static(__dirname + '/public'));
app.use(express.json());

const NSUN  = [2,3,5,6,7,8,8,7,5,4,2,2];                  // ensoleillement h/j

async function fetchAndStoreWeather() {
    console.log('Fetching and storing weather data...');
    let weatherData = await kv.get('weatherData') || [];

    const end   = new Date(); end.setDate(end.getDate() - 1);
    const start = new Date(end); start.setDate(start.getDate() - 60 + 1);
    const fmt   = d => d.toISOString().split('T')[0];
    const url   = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=48.1351&longitude=11.5820`
      + `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,`
      + `precipitation_sum,snowfall_sum,sunshine_duration`
      + `&start_date=${fmt(start)}&end_date=${fmt(end)}&timezone=Europe/Berlin`;

    try {
        const { daily: d } = await (await axios.get(url)).data;
        const days = d.time.map((t, i) => ({
            d:       new Date(t).toISOString().split('T')[0],
            mo:      new Date(t).getMonth(),
            precip:  d.precipitation_sum[i]   ?? 0,
            snow:    d.snowfall_sum[i]         ?? 0,
            tmax:    d.temperature_2m_max[i]   ?? null,
            tmin:    d.temperature_2m_min[i]   ?? null,
            tmean:   d.temperature_2m_mean[i]  ?? null,
            sun:     Math.round((d.sunshine_duration[i] ?? 0) / 3600 * 10) / 10,
            sunNorm: NSUN[new Date(t).getMonth()],
        }));

        const newDays = days.filter(day => !weatherData.some(existingDay => existingDay.d === day.d));
        
        if (newDays.length > 0) {
            weatherData.push(...newDays);
            weatherData.sort((a, b) => new Date(b.d) - new Date(a.d));
            await kv.set('weatherData', weatherData);
            console.log(`${newDays.length} new days of weather data added.`);
        } else {
            console.log('No new weather data to add.');
        }

    } catch (error) {
        console.error('Error fetching or storing weather data:', error);
    }
}

app.get('/api/weather', async (req, res) => {
  const weatherData = await kv.get('weatherData') || [];
  res.json(weatherData);
});

app.get('/api/fetch', async (req, res) => {
    await fetchAndStoreWeather();
    res.redirect('/');
});

app.post('/api/fetch', async (req, res) => {
    await fetchAndStoreWeather();
    res.sendStatus(200);
});

// Fetch data on server start
fetchAndStoreWeather();

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
