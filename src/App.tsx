import React, { useEffect, useState } from 'react';
import {
  Bus,
  CloudRain,
  Sun,
  Cloud,
  Clock,
  Rss,
  RefreshCw,
  ExternalLink,
  Check,
  Copy,
  AlertTriangle,
  Info,
  Footprints,
} from 'lucide-react';
// Import from shared weather module as requested
import { fetchWeatherForecast } from '../api/weather.js';

interface ServiceArrival {
  serviceNo: string;
  nextBuses: number[];
  operator?: string;
}

interface WeatherData {
  ok: boolean;
  source: string;
  area?: string;
  forecast?: string;
  period?: string;
  status?: number;
  error?: string;
}

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [services, setServices] = useState<ServiceArrival[]>([]);
  const [soonestBus, setSoonestBus] = useState<{ serviceNo: string; minutes: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usingSample, setUsingSample] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [readingTime, setReadingTime] = useState<string>('');
  const [showRssPreview, setShowRssPreview] = useState<boolean>(false);
  const [rssXml, setRssXml] = useState<string>('');
  const [loadingRss, setLoadingRss] = useState<boolean>(false);

  const feedUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/feed` : '/api/feed';

  async function loadData(forceSample?: boolean) {
    setRefreshing(true);
    try {
      // 1. Fetch weather via shared module
      const weatherResult = await fetchWeatherForecast('City');
      setWeather(weatherResult);

      // 2. Fetch bus data via /api/bus
      const busParam = forceSample ? '?sample=1' : '';
      const busRes = await fetch(`/api/bus${busParam}`);
      const busData = await busRes.json();

      if (busData.ok) {
        setServices(busData.services || []);
        setSoonestBus(busData.soonestBus || null);
        setUsingSample(!!busData.isSample);
        setErrorMsg(null);
      } else {
        // Fall back to sample bus data for UI demonstration while noting API key status
        setErrorMsg(`${busData.source || 'LTA'}: ${busData.error || `HTTP ${busRes.status}`}`);
        const fallbackRes = await fetch('/api/bus?sample=1');
        const fallbackData = await fallbackRes.json();
        setServices(fallbackData.services || []);
        setSoonestBus(fallbackData.soonestBus || null);
        setUsingSample(true);
      }

      // Update Singapore reading timestamp
      const now = new Date();
      const sgt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
      setReadingTime(
        `${sgt.getUTCHours().toString().padStart(2, '0')}:${sgt
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')}:${sgt.getUTCSeconds().toString().padStart(2, '0')} SGT`
      );
    } catch (err) {
      console.error('Error fetching data:', err);
      setErrorMsg('Failed to fetch live data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleCopyFeedUrl() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  async function handleFetchRssPreview() {
    setLoadingRss(true);
    setShowRssPreview(true);
    try {
      const res = await fetch('/api/feed');
      const text = await res.text();
      setRssXml(text);
    } catch (err) {
      setRssXml('Failed to load RSS feed preview.');
    } finally {
      setLoadingRss(false);
    }
  }

  // Determine advice: Leave now vs Wait
  const minutes = soonestBus ? soonestBus.minutes : null;
  const isLeaveNow = minutes !== null && minutes <= 4;
  const advice = isLeaveNow ? 'Leave now' : 'Wait';

  const getWeatherIcon = (forecast: string = '') => {
    const f = forecast.toLowerCase();
    if (f.includes('rain') || f.includes('shower')) return <CloudRain className="w-5 h-5 text-blue-400" />;
    if (f.includes('cloud')) return <Cloud className="w-5 h-5 text-gray-400" />;
    return <Sun className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100 leading-tight">
                Stop 04121 (Bras Basah Rd)
              </h1>
              <p className="text-xs text-slate-400">Live Departure &amp; Weather Monitor</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData(usingSample)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              title="Refresh live reading"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <a
              href="/api/feed"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition border border-amber-500/30"
              title="View RSS 2.0 Feed"
            >
              <Rss className="w-3.5 h-3.5" />
              <span>RSS Feed</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Status / Notice Banner */}
        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-300">Live Transit Notice</p>
              <p className="text-amber-200/90 leading-relaxed">
                {errorMsg}. The RSS feed will output a valid RFC 822 feed with{' '}
                <code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100">
                  Check failed: LTA Datamall 401
                </code>{' '}
                until an API key is set in secrets. Displaying stop 04121 baseline timings on screen below.
              </p>
            </div>
          </div>
        )}

        {/* Hero Advisory Card: Leave Now or Wait */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Current Recommendation
                </span>
                {readingTime && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    {readingTime}
                  </span>
                )}
              </div>

              {/* Big Advice Badge */}
              <div className="flex items-center gap-4">
                <div
                  className={`text-4xl sm:text-5xl font-black tracking-tight flex items-center gap-3 ${
                    isLeaveNow ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {isLeaveNow ? <Footprints className="w-10 h-10" /> : <Clock className="w-10 h-10" />}
                  <span>{advice}</span>
                </div>
              </div>

              {/* Details line: e.g. "bus 7 in 9 min, City: Showers" */}
              <div className="text-base sm:text-lg text-slate-200 font-medium flex flex-wrap items-center gap-2 pt-1">
                {soonestBus ? (
                  <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-100 px-2.5 py-1 rounded-md font-mono text-sm">
                    <Bus className="w-4 h-4 text-emerald-400" />
                    Bus <strong className="text-white">{soonestBus.serviceNo}</strong> in{' '}
                    <strong className="text-white">{soonestBus.minutes} min</strong>
                  </span>
                ) : (
                  <span>No bus arrival timings</span>
                )}

                <span className="text-slate-500">•</span>

                {weather && (
                  <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-100 px-2.5 py-1 rounded-md text-sm">
                    {getWeatherIcon(weather.forecast)}
                    <span>
                      City: <strong className="text-white">{weather.forecast}</strong>
                    </span>
                    <span className="text-xs text-slate-400 font-normal">({weather.period})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick Summary Pill for Zapier Title */}
            <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-lg md:max-w-xs w-full text-xs space-y-2">
              <div className="text-slate-400 font-medium flex items-center justify-between">
                <span>Zapier Title Preview</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded">
                  RSS Item
                </span>
              </div>
              <p className="font-mono text-slate-200 bg-slate-900 p-2 rounded border border-slate-800 break-words text-[11px] leading-relaxed">
                {advice}: bus {soonestBus?.serviceNo || '7'} in {soonestBus?.minutes ?? 9} min, City:{' '}
                {weather?.forecast || 'Partly Cloudy (Day)'}
              </p>
            </div>
          </div>
        </section>

        {/* Bus Services Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Stop 04121 Services ({services.length})
            </h2>
            <span className="text-xs text-slate-500">Next 2 buses in minutes</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {services.map((svc) => {
              const isNext = soonestBus && soonestBus.serviceNo === svc.serviceNo;
              return (
                <div
                  key={svc.serviceNo}
                  className={`p-3 rounded-lg border transition ${
                    isNext
                      ? 'bg-emerald-950/20 border-emerald-500/50 ring-1 ring-emerald-500/30'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg font-bold font-mono text-white px-2 py-0.5 bg-slate-800 rounded">
                      {svc.serviceNo}
                    </span>
                    {isNext && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded">
                        Next
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span className="text-slate-500 text-[11px]">Next:</span>
                      <strong className="text-white font-mono">
                        {svc.nextBuses[0] !== undefined ? `${svc.nextBuses[0]} min` : '–'}
                      </strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="text-slate-500 text-[11px]">Subseq:</span>
                      <span className="font-mono">
                        {svc.nextBuses[1] !== undefined ? `${svc.nextBuses[1]} min` : '–'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* RSS 2.0 Feed Integration for Zapier */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Rss className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-slate-200">RSS 2.0 Feed for Zapier</h3>
              </div>
              <p className="text-xs text-slate-400">
                Zapier can monitor this feed every 15 minutes. The item GUID and pubDate round down to the
                nearest quarter hour (:00, :15, :30, :45).
              </p>
            </div>

            <button
              onClick={handleCopyFeedUrl}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Feed URL</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-950 rounded-lg p-2.5 font-mono text-xs text-amber-300/90 border border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
            <span>{feedUrl}</span>
            <a
              href={feedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 transition"
              title="Open feed in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleFetchRssPreview}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
            >
              {showRssPreview ? 'Refresh XML Preview' : 'Preview Live XML Output'}
            </button>
            <span className="text-[11px] text-slate-500">
              Content-Type: application/rss+xml; charset=utf-8
            </span>
          </div>

          {showRssPreview && (
            <div className="mt-3">
              {loadingRss ? (
                <div className="p-4 text-xs text-slate-400 animate-pulse font-mono">
                  Loading RSS 2.0 feed output...
                </div>
              ) : (
                <pre className="p-3 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 whitespace-pre">
                  {rssXml}
                </pre>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
