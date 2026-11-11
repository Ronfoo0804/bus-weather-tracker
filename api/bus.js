/**
 * LTA Datamall Bus Arrival API integration for Stop 04121.
 * Provides live bus arrival times and simplified data structures.
 */

export function calculateMinutesUntil(isoString) {
  if (!isoString) return null;
  const arrivalTime = new Date(isoString).getTime();
  if (isNaN(arrivalTime)) return null;
  const diffMinutes = Math.round((arrivalTime - Date.now()) / 60000);
  return Math.max(0, diffMinutes);
}

// Realistic sample bus arrival dataset for Stop 04121 (Bras Basah Rd / SMU)
export function getSampleBusData(busStopCode = '04121') {
  const services = [
    { serviceNo: '7', nextBuses: [9, 22] },
    { serviceNo: '14', nextBuses: [4, 16] },
    { serviceNo: '16', nextBuses: [12, 25] },
    { serviceNo: '36', nextBuses: [8, 19] },
    { serviceNo: '77', nextBuses: [15, 28] },
    { serviceNo: '106', nextBuses: [6, 18] },
    { serviceNo: '111', nextBuses: [11, 24] },
    { serviceNo: '131', nextBuses: [14, 27] },
    { serviceNo: '162', nextBuses: [20, 35] },
    { serviceNo: '167', nextBuses: [18, 30] },
    { serviceNo: '175', nextBuses: [7, 21] },
    { serviceNo: '502', nextBuses: [13, 26] },
    { serviceNo: '857', nextBuses: [5, 17] },
  ];

  // Bus 7 in 9 min matches the user's example in the prompt
  return {
    ok: true,
    source: 'LTA Datamall',
    busStopCode,
    isSample: true,
    services,
    soonestBus: { serviceNo: '7', minutes: 9 },
    timestamp: new Date().toISOString(),
  };
}

export async function fetchBusArrivals(busStopCode = '04121', options = {}) {
  // Read key strictly through process.env without leaking it anywhere
  const apiKey =
    process.env.LTA_DATAMALL_API_KEY ||
    process.env.LTA_API_KEY ||
    process.env.DATAMALL_KEY ||
    process.env.DATAMALL_API_KEY ||
    process.env.ACCOUNT_KEY;

  if (options.useSample) {
    return getSampleBusData(busStopCode);
  }

  if (!apiKey) {
    return {
      ok: false,
      source: 'LTA Datamall',
      status: 401,
      error: 'API key is missing',
    };
  }

  try {
    const url = `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(
      busStopCode
    )}`;
    const res = await fetch(url, {
      headers: {
        AccountKey: apiKey,
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      return {
        ok: false,
        source: 'LTA Datamall',
        status: res.status,
        error: `Upstream HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const rawServices = data?.Services || [];

    const services = rawServices
      .map((svc) => {
        const b1 = calculateMinutesUntil(svc.NextBus?.EstimatedArrival);
        const b2 = calculateMinutesUntil(svc.NextBus2?.EstimatedArrival);
        const nextBuses = [b1, b2].filter((m) => m !== null && m !== undefined);
        return {
          serviceNo: svc.ServiceNo,
          operator: svc.Operator,
          nextBuses,
          nextBusDetails: svc.NextBus,
        };
      })
      .sort((a, b) => a.serviceNo.localeCompare(b.serviceNo, undefined, { numeric: true }));

    // Find soonest arriving bus
    let soonestBus = null;
    for (const svc of services) {
      if (svc.nextBuses.length > 0) {
        const firstMin = svc.nextBuses[0];
        if (!soonestBus || firstMin < soonestBus.minutes) {
          soonestBus = { serviceNo: svc.serviceNo, minutes: firstMin };
        }
      }
    }

    return {
      ok: true,
      source: 'LTA Datamall',
      busStopCode,
      services,
      soonestBus,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      source: 'LTA Datamall',
      status: 502,
      error: err instanceof Error ? err.message : 'Network error fetching LTA data',
    };
  }
}

export default async function busHandler(req, res) {
  const busStopCode = req.query.busStopCode ? String(req.query.busStopCode) : '04121';
  const useSample = req.query.sample === '1' || req.query.mock === '1';

  const result = await fetchBusArrivals(busStopCode, { useSample });

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

  const statusCode = result.ok ? 200 : result.status || 500;
  res.status(statusCode).json(result);
}
