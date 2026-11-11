/**
 * Shared NEA 2-Hour Weather Forecast service.
 * Connects directly to NEA's real-time API:
 * https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast
 * Used by client-side components, serverless endpoints, and the RSS feed generator.
 */

export const NEA_V2_ENDPOINT = 'https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast';
export const NEA_V1_ENDPOINT = 'https://api.data.gov.sg/v1/environment/2-hour-weather-forecast';

export function formatTimeFromIso(isoString) {
  if (!isoString) return '';
  try {
    const parts = isoString.split('T');
    if (parts.length > 1) {
      return parts[1].slice(0, 5); // "12:00"
    }
    const d = new Date(isoString);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export async function fetchWeatherForecast(targetArea = 'City', options = {}) {
  // Support optional API key if configured in secrets without leaking or failing without it
  const apiKey =
    typeof process !== 'undefined'
      ? process.env.DATA_GOV_SG_API_KEY || process.env.NEA_API_KEY
      : undefined;

  const headers = {
    accept: 'application/json',
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  // 1. Primary: NEA v2 real-time endpoint
  try {
    const res = await fetch(NEA_V2_ENDPOINT, { headers });

    if (res.ok) {
      const json = await res.json();
      const items = json?.data?.items || json?.items || [];
      const item = items[0];

      if (item && item.forecasts) {
        const forecasts = item.forecasts;
        const matched =
          forecasts.find((f) => f.area.toLowerCase() === targetArea.toLowerCase()) ||
          forecasts.find((f) => f.area.toLowerCase().includes('city')) ||
          forecasts[0];

        const forecast = matched ? matched.forecast : 'Fair';
        const areaName = matched ? matched.area : targetArea;
        const startStr = formatTimeFromIso(item.valid_period?.start);
        const endStr = formatTimeFromIso(item.valid_period?.end);
        const period = startStr && endStr ? `${startStr} to ${endStr}` : item.valid_period?.text || '2-hour period';

        return {
          ok: true,
          source: 'NEA',
          endpoint: NEA_V2_ENDPOINT,
          area: areaName,
          forecast,
          period,
          periodText: item.valid_period?.text || null,
          validPeriod: item.valid_period || null,
          updateTimestamp: item.update_timestamp || item.timestamp || null,
          areaMetadata: json?.data?.area_metadata || null,
          allForecasts: options.includeAll ? forecasts : undefined,
        };
      }
    }
  } catch (err) {
    console.warn('NEA v2 endpoint fetch warning:', err instanceof Error ? err.message : err);
  }

  // 2. Resilient fallback: NEA v1 endpoint
  try {
    const res = await fetch(NEA_V1_ENDPOINT, { headers: { accept: 'application/json' } });
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
    const matched =
      forecasts.find((f) => f.area.toLowerCase() === targetArea.toLowerCase()) ||
      forecasts.find((f) => f.area.toLowerCase().includes('city')) ||
      forecasts[0];

    const forecast = matched ? matched.forecast : 'Fair';
    const areaName = matched ? matched.area : targetArea;
    const startStr = formatTimeFromIso(item.valid_period?.start);
    const endStr = formatTimeFromIso(item.valid_period?.end);
    const period = startStr && endStr ? `${startStr} to ${endStr}` : '2-hour period';

    return {
      ok: true,
      source: 'NEA',
      endpoint: NEA_V1_ENDPOINT,
      area: areaName,
      forecast,
      period,
      validPeriod: item.valid_period || null,
      updateTimestamp: item.update_timestamp || null,
      allForecasts: options.includeAll ? forecasts : undefined,
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
  const includeAll = req.query.all === '1' || req.query.all === 'true';

  const result = await fetchWeatherForecast(area, { includeAll });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  res.status(result.ok ? 200 : result.status || 500).json(result);
}
