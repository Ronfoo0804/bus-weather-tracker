/**
 * Shared NEA 2-Hour Weather Forecast service.
 * Used by both client-side components and server-side RSS feed generator.
 */

export function formatTimeFromIso(isoString) {
  if (!isoString) return '';
  try {
    const parts = isoString.split('T');
    if (parts.length > 1) {
      const timePart = parts[1].slice(0, 5); // "11:30"
      return timePart;
    }
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export async function fetchWeatherForecast(targetArea = 'City') {
  try {
    const url = 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast';
    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        source: 'NEA',
        status: res.status,
        error: `NEA API returned status ${res.status}`,
      };
    }

    const data = await res.json();
    const item = data?.items?.[0];

    if (!item) {
      return {
        ok: false,
        source: 'NEA',
        status: 502,
        error: 'No forecast items in NEA response',
      };
    }

    const forecasts = item.forecasts || [];
    const matched = forecasts.find(
      (f) => f.area.toLowerCase() === targetArea.toLowerCase()
    ) || forecasts.find((f) => f.area.toLowerCase().includes('city')) || forecasts[0];

    const forecast = matched ? matched.forecast : 'Fair';
    const areaName = matched ? matched.area : targetArea;
    const startStr = formatTimeFromIso(item.valid_period?.start);
    const endStr = formatTimeFromIso(item.valid_period?.end);
    const period = startStr && endStr ? `${startStr} to ${endStr}` : '2-hour period';

    return {
      ok: true,
      source: 'NEA',
      area: areaName,
      forecast,
      period,
      validPeriod: item.valid_period || null,
      updateTimestamp: item.update_timestamp || null,
    };
  } catch (err) {
    return {
      ok: false,
      source: 'NEA',
      status: 500,
      error: err instanceof Error ? err.message : 'Unknown NEA fetch error',
    };
  }
}

export default async function weatherHandler(req, res) {
  const area = req.query.area ? String(req.query.area) : 'City';
  const result = await fetchWeatherForecast(area);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.status(result.ok ? 200 : (result.status || 500)).json(result);
}
