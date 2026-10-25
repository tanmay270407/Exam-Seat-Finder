/**
 * Vercel Serverless Function & Express Route Handler
 * Endpoint: /api/total-visitors
 *
 * Securely retrieves the total historical visitor count from the official Vercel Web Analytics API
 * using the VERCEL_ACCESS_TOKEN environment variable. Never exposes secrets to the browser.
 */

// In-memory cache for API responses (TTL: 30 seconds to allow rapid updates while protecting against rate limits)
let cache: {
  totalVisitors: number;
  pageviews: number | null;
  period: string;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache (reduced from 5 minutes)

export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method && req.method !== 'GET') {
    if (typeof res.setHeader === 'function') {
      res.setHeader('Allow', ['GET']);
    }
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Set standard security and anti-stale caching headers
  if (typeof res.setHeader === 'function') {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Short edge CDN cache (10s) with brief stale-while-revalidate (20s) so Vercel CDN never keeps stale counts
    // max-age=0 and must-revalidate ensure browsers never use disk/memory HTTP cache
    res.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=10, stale-while-revalidate=20, must-revalidate'
    );
    res.setHeader('Pragma', 'no-cache');
  }

  // Check cache first (fresh if under 30s)
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    if (typeof res.setHeader === 'function') {
      res.setHeader('X-Cache', 'HIT');
    }
    return res.status(200).json({
      totalVisitors: cache.totalVisitors,
      pageviews: cache.pageviews,
      period: cache.period,
      available: true,
      cached: true,
      updatedAt: new Date(cache.timestamp).toISOString(),
    });
  }

  // 1. Retrieve Vercel Access Token
  const token = process.env.VERCEL_ACCESS_TOKEN || process.env.VERCEL_TOKEN;
  if (!token) {
    return res.status(200).json({
      totalVisitors: null,
      available: false,
      error: 'VERCEL_ACCESS_TOKEN environment variable not configured',
      period: null,
    });
  }

  // 2. Identify Project and Team
  const configuredProject =
    process.env.VERCEL_PROJECT_ID ||
    process.env.PROJECT_ID ||
    process.env.VERCEL_PROJECT_NAME ||
    process.env.VERCEL_GIT_REPO_SLUG;

  // If not explicitly set in env, test the primary project name and fallback slug
  const projectCandidates = configuredProject
    ? [configuredProject]
    : ['exam-seat-finder', 'exam-seat-finder-gules'];

  const teamId = process.env.VERCEL_TEAM_ID || process.env.TEAM_ID || undefined;

  // 3. Helper to query Vercel Web Analytics API
  const queryVercel = async (
    targetProjectId: string,
    options: {
      since?: number | string;
      until?: number | string;
      withEnvironmentFilter?: boolean;
    }
  ) => {
    const url = new URL('https://api.vercel.com/v1/query/web-analytics/visits/count');
    url.searchParams.set('projectId', targetProjectId);
    if (teamId) {
      url.searchParams.set('teamId', teamId);
    }
    if (options.withEnvironmentFilter) {
      url.searchParams.set('filter', "environment eq 'production'");
    }
    if (options.since) {
      url.searchParams.set('since', String(options.since));
    }
    if (options.until) {
      url.searchParams.set('until', String(options.until));
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      // response wasn't JSON
    }

    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  };

  try {
    // Strategy for broadest historical period while strictly matching production:
    // 1. Explicit VERCEL_ANALYTICS_SINCE if configured by user
    // 2. All-time without `since` parameter (Vercel computes from project enablement)
    // 3. 365 days (12 months Pro retention)
    // 4. 30 days (Hobby retention limit)
    // Both with environment eq 'production' and fallback without if custom environment
    const now = Date.now();
    const attempts: Array<{
      since?: number | string;
      until?: number | string;
      withEnvironmentFilter: boolean;
      period: string;
    }> = [];

    if (process.env.VERCEL_ANALYTICS_SINCE) {
      attempts.push({
        since: process.env.VERCEL_ANALYTICS_SINCE,
        until: now,
        withEnvironmentFilter: true,
        period: 'All-time',
      });
    }

    attempts.push(
      // Primary: Production environment filter
      { since: undefined, withEnvironmentFilter: true, period: 'All-time' },
      { since: now - 365 * 24 * 60 * 60 * 1000, until: now, withEnvironmentFilter: true, period: 'Past 12 months' },
      { since: now - 30 * 24 * 60 * 60 * 1000, until: now, withEnvironmentFilter: true, period: 'Past 30 days' },
      // Fallback: If production filter is unpopulated
      { since: undefined, withEnvironmentFilter: false, period: 'All-time' },
      { since: now - 365 * 24 * 60 * 60 * 1000, until: now, withEnvironmentFilter: false, period: 'Past 12 months' },
      { since: now - 30 * 24 * 60 * 60 * 1000, until: now, withEnvironmentFilter: false, period: 'Past 30 days' }
    );

    let successfulResult: { visitors: number; pageviews: number | null; period: string } | null = null;
    let lastError: string | null = null;

    // Try project candidates (resolves 'exam-seat-finder' or 'exam-seat-finder-gules')
    for (const projId of projectCandidates) {
      for (const attempt of attempts) {
        const result = await queryVercel(projId, attempt);
        if (result.ok && result.data?.data && typeof result.data.data.visitors === 'number') {
          successfulResult = {
            visitors: result.data.data.visitors,
            pageviews: typeof result.data.data.pageviews === 'number' ? result.data.data.pageviews : null,
            period: attempt.period,
          };
          break;
        } else if (!result.ok) {
          lastError = result.data?.error?.message || `HTTP ${result.status}`;
          // If 401 Unauthorized or 403 Forbidden, stop immediately as token is invalid
          if (result.status === 401 || result.status === 403) {
            break;
          }
          // If 404 Project Not Found, move to next project candidate
          if (result.status === 404) {
            break;
          }
        }
      }

      if (successfulResult) {
        break;
      }
    }

    if (successfulResult) {
      // Update in-memory cache with fresh data
      cache = {
        totalVisitors: successfulResult.visitors,
        pageviews: successfulResult.pageviews,
        period: successfulResult.period,
        timestamp: Date.now(),
      };

      if (typeof res.setHeader === 'function') {
        res.setHeader('X-Cache', 'MISS');
      }

      return res.status(200).json({
        totalVisitors: successfulResult.visitors,
        pageviews: successfulResult.pageviews,
        period: successfulResult.period,
        available: true,
        cached: false,
        updatedAt: new Date().toISOString(),
      });
    }

    // If query failed upstream
    console.warn('Vercel Analytics query was unsuccessful:', lastError);
    return res.status(200).json({
      totalVisitors: null,
      available: false,
      error: 'Analytics data temporarily unavailable from Vercel',
      period: null,
    });
  } catch (error: any) {
    console.error('Unexpected error in total-visitors endpoint:', error?.message || error);
    return res.status(200).json({
      totalVisitors: null,
      available: false,
      error: 'Internal error communicating with analytics service',
      period: null,
    });
  }
}
