/**
 * RSS 2.0 Feed Generator for Stop 04121 Bus & Weather Reading.
 * Provides live reading feeds for Zapier monitoring.
 */

import { fetchBusArrivals, getSampleBusData } from './bus.js';
import { fetchWeatherForecast } from './weather.js';

export function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getSingaporeTimeInfo(date = new Date()) {
  const sgtOffsetMs = 8 * 60 * 60 * 1000;
  const sgtDate = new Date(date.getTime() + sgtOffsetMs);

  const year = sgtDate.getUTCFullYear();
  const month = sgtDate.getUTCMonth(); // 0-11
  const day = sgtDate.getUTCDate();
  const dayOfWeek = sgtDate.getUTCDay(); // 0 = Sun
  const hours = sgtDate.getUTCHours();
  const rawMinutes = sgtDate.getUTCMinutes();
  const seconds = sgtDate.getUTCSeconds();
  const roundedMinutes = Math.floor(rawMinutes / 15) * 15;

  const pad = (n) => String(n).padStart(2, '0');
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // e.g. 2026-11-11T14:15+08:00
  const roundedIso = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(roundedMinutes)}+08:00`;
  const guid = `g1-leave-${roundedIso}`;
  const pubDate = `${dayNames[dayOfWeek]}, ${pad(day)} ${monthNames[month]} ${year} ${pad(hours)}:${pad(roundedMinutes)}:00 +0800`;
  const lastBuildDate = `${dayNames[dayOfWeek]}, ${pad(day)} ${monthNames[month]} ${year} ${pad(hours)}:${pad(rawMinutes)}:${pad(seconds)} +0800`;
  const readingTimeSgt = `${pad(day)} ${monthNames[month]} ${year} ${pad(hours)}:${pad(rawMinutes)}:${pad(seconds)} +08:00 (SGT)`;

  return { roundedIso, guid, pubDate, lastBuildDate, readingTimeSgt };
}

export function getSiteAddress(req) {
  const host = (req?.get ? req.get('host') : req?.headers?.host) || 'localhost:3000';
  const protoHeader = req?.headers ? (req.headers['x-forwarded-proto'] || req.protocol || 'http') : 'http';
  const proto = String(protoHeader).split(',')[0].trim();
  return `${proto}://${host}`;
}

export async function generateRssFeed(req) {
  const siteAddress = getSiteAddress(req);
  const timeInfo = getSingaporeTimeInfo();

  const useSample = req?.query?.sample === '1' || req?.query?.mock === '1';

  // Fetch from shared modules without calling this site's own HTTP address
  const [busResult, weatherResult] = await Promise.all([
    fetchBusArrivals('04121', { useSample }),
    fetchWeatherForecast('City'),
  ]);

  let itemTitle = '';
  let itemDescription = '';

  const failures = [];
  if (!busResult.ok) {
    failures.push(`${busResult.source || 'LTA Datamall'} ${busResult.status || 500}`);
  }
  if (!weatherResult.ok) {
    failures.push(`${weatherResult.source || 'NEA'} ${weatherResult.status || 500}`);
  }

  if (failures.length > 0) {
    // If a source fails or a key is missing, title starts with "Check failed:"
    itemTitle = `Check failed: ${failures.join(', ')}`;

    const descLines = [
      `Check failed: ${failures.join(', ')}.`,
    ];
    if (busResult.ok && busResult.services) {
      descLines.push('\nStop 04121 Bus Arrivals:');
      for (const s of busResult.services) {
        descLines.push(`Service ${s.serviceNo}: ${s.nextBuses.map((m) => `${m} min`).join(', ') || 'no timing'}`);
      }
    }
    if (weatherResult.ok) {
      descLines.push(`\nCity Forecast: ${weatherResult.forecast} (covers ${weatherResult.period})`);
    }
    descLines.push(`\nReading time: ${timeInfo.readingTimeSgt}`);
    itemDescription = descLines.join('\n');
  } else {
    // Both succeeded: determine advice (Leave now or Wait)
    const soonest = busResult.soonestBus;
    const minutes = soonest ? soonest.minutes : null;
    const serviceNo = soonest ? soonest.serviceNo : '?';

    // Advice rule: if next bus is arriving in <= 4 min, Leave now; otherwise Wait
    const advice = minutes !== null && minutes <= 4 ? 'Leave now' : 'Wait';
    const busPart = minutes !== null ? `bus ${serviceNo} in ${minutes} min` : 'no buses scheduled';
    itemTitle = `${advice}: ${busPart}, City: ${weatherResult.forecast}`;

    const descLines = [];
    descLines.push('Stop 04121 bus arrivals:');
    if (busResult.services && busResult.services.length > 0) {
      for (const s of busResult.services) {
        const timings = s.nextBuses && s.nextBuses.length > 0
          ? s.nextBuses.map((m) => `${m} min`).join(', ')
          : 'no timing available';
        descLines.push(`Service ${s.serviceNo}: ${timings}`);
      }
    } else {
      descLines.push('No services currently arriving.');
    }

    descLines.push(`\nNEA forecast for City: ${weatherResult.forecast} (covers ${weatherResult.period})`);
    descLines.push(`Reading time: ${timeInfo.readingTimeSgt}`);

    itemDescription = descLines.join('\n');
  }

  // Escape &, <, > in all text fields, plain text in description with no HTML
  const escapedChannelTitle = escapeXml('Stop 04121 Bus & Weather Reading');
  const escapedChannelDesc = escapeXml('Live transit arrival reading for stop 04121 and NEA 2-hour weather forecast.');
  const escapedChannelLink = escapeXml(siteAddress);
  const escapedLastBuildDate = escapeXml(timeInfo.lastBuildDate);

  const escapedItemTitle = escapeXml(itemTitle);
  const escapedItemDesc = escapeXml(itemDescription);
  const itemLink = `${siteAddress}/?reading=${timeInfo.roundedIso}`;
  const escapedItemLink = escapeXml(itemLink);
  const escapedGuid = escapeXml(timeInfo.guid);
  const escapedPubDate = escapeXml(timeInfo.pubDate);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapedChannelTitle}</title>
    <link>${escapedChannelLink}</link>
    <description>${escapedChannelDesc}</description>
    <lastBuildDate>${escapedLastBuildDate}</lastBuildDate>
    <item>
      <title>${escapedItemTitle}</title>
      <description>${escapedItemDesc}</description>
      <link>${escapedItemLink}</link>
      <guid isPermaLink="false">${escapedGuid}</guid>
      <pubDate>${escapedPubDate}</pubDate>
    </item>
  </channel>
</rss>`.trim();

  return xml;
}

export default async function feedHandler(req, res) {
  try {
    const xml = await generateRssFeed(req);

    // Header Content-Type: application/rss+xml; charset=utf-8
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    // Cache-Control: s-maxage=20, stale-while-revalidate=40
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');

    // Always answers 200 with valid RSS
    res.status(200).send(xml);
  } catch (err) {
    // Fallback safe RSS response if an unexpected internal exception occurs
    const timeInfo = getSingaporeTimeInfo();
    const siteAddress = getSiteAddress(req);
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Stop 04121 Bus &amp; Weather Reading</title>
    <link>${escapeXml(siteAddress)}</link>
    <description>Live transit arrival reading for stop 04121 and NEA 2-hour weather forecast.</description>
    <lastBuildDate>${escapeXml(timeInfo.lastBuildDate)}</lastBuildDate>
    <item>
      <title>Check failed: Internal 500</title>
      <description>${escapeXml(`Check failed: Internal server error. Reading time: ${timeInfo.readingTimeSgt}`)}</description>
      <link>${escapeXml(`${siteAddress}/?reading=${timeInfo.roundedIso}`)}</link>
      <guid isPermaLink="false">${escapeXml(timeInfo.guid)}</guid>
      <pubDate>${escapeXml(timeInfo.pubDate)}</pubDate>
    </item>
  </channel>
</rss>`.trim();

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
    res.status(200).send(fallbackXml);
  }
}
