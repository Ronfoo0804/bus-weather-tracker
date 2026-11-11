/**
 * Serverless API route for NEA Real-Time 2-Hour Weather Forecast.
 * Primary Endpoint: https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast
 *
 * Supported query params:
 *   - ?area=City (defaults to City, or any Singapore region e.g. Changi, Sentosa)
 *   - ?all=1 (includes all 47 area forecasts)
 */

import { fetchWeatherForecast, NEA_V2_ENDPOINT } from './weather.js';

export default async function neaHandler(req, res) {
  const area = req.query?.area ? String(req.query.area) : 'City';
  const includeAll = req.query?.all !== '0'; // default include all forecasts for full data view

  const result = await fetchWeatherForecast(area, { includeAll });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  const statusCode = result.ok ? 200 : result.status || 500;
  res.status(statusCode).json({
    ...result,
    serverless: true,
    liveEndpoint: NEA_V2_ENDPOINT,
  });
}
