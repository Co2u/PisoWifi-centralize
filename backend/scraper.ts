import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';
import db from './db.js';
import { getAppDateString } from './time.js';

const REQUEST_TIMEOUT = 30000;
const SCRAPE_CONCURRENCY = 5;
const LOGIN_ERROR_PATTERNS = [
  'invalid credentials',
  'incorrect',
  'failed csrf',
  'csrf',
  'login failed',
  'access denied',
];

const selectDeviceStatement = db.prepare('SELECT * FROM devices WHERE id = ?');
const selectDeviceIdStatement = db.prepare('SELECT id FROM devices WHERE id = ?');
const selectDeviceIdsStatement = db.prepare('SELECT id FROM devices');
const selectIncomeLogStatement = db.prepare('SELECT id, amount FROM income_logs WHERE device_id = ? AND date = ?');
const updateIncomeLogStatement = db.prepare('UPDATE income_logs SET amount = ?, raw_value = ?, created_at = CURRENT_TIMESTAMP WHERE device_id = ? AND date = ?');
const insertIncomeLogStatement = db.prepare('INSERT INTO income_logs (device_id, amount, date, raw_value) VALUES (?, ?, ?, ?)');
const markDeviceOnlineStatement = db.prepare("UPDATE devices SET status = 'online', last_seen = CURRENT_TIMESTAMP, active_users = ? WHERE id = ?");
const markDeviceOfflineStatement = db.prepare("UPDATE devices SET status = 'offline' WHERE id = ?");
const insertScrapeLogStatement = db.prepare('INSERT INTO scrape_logs (device_id, status, message) VALUES (?, ?, ?)');

const inFlightDeviceScrapes = new Map<number, Promise<any>>();
let inFlightAllScrape: Promise<any[]> | null = null;

function normalizeBaseUrl(value: string) {
  let baseUrl = value.trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `http://${baseUrl}`;
  }
  return baseUrl.replace(/\/+$/, '');
}

function toAbsoluteUrl(baseUrl: string, value: string) {
  return new URL(value, `${baseUrl}/`).toString();
}

function getPrimaryStatsUrl(baseUrl: string) {
  return `${baseUrl}/admin/system`;
}

function looksLikeStatsPage(html: string) {
  const text = html.toLowerCase();
  return (
    text.includes("today&#039;s sales") ||
    text.includes("today's sales") ||
    text.includes('daily sales') ||
    text.includes('/admin/sales') ||
    text.includes('overall sales')
  );
}

function looksLikeLoginPage(html: string) {
  const text = html.toLowerCase();
  return (
    text.includes('sign in to start your session') ||
    text.includes('name="password"') ||
    text.includes('id="frm-login"') ||
    text.includes('/auth/signin/')
  );
}

function parseStats(html: string) {
  const $ = cheerio.load(html);
  const incomeCandidateTexts = [
    $('*:contains("Today\'s Sales")').last().parent().text(),
    $('*:contains("Today\'s Sales")').last().text(),
    $('.info-box:contains("Today\'s Sales") .info-box-number').first().text(),
    $('.small-box:contains("Today\'s Sales") .inner h3').first().text(),
    $('#daily-income').text(),
    $('.daily-sales').first().text(),
    $('div:contains("Daily Income")').next().text(),
    $('div:contains("Income Today")').next().text(),
    $('.income-today').first().text(),
  ].filter(Boolean);

  let incomeAmount = 0;
  for (const candidate of incomeCandidateTexts) {
    const cleaned = candidate.replace(/[^0-9.]/g, '');
    const amount = parseFloat(cleaned);
    if (!Number.isNaN(amount)) {
      incomeAmount = amount;
      break;
    }
  }

  const activeUserCandidateTexts = [
    $('*:contains("Wifi Clients")').last().parent().text(),
    $('*:contains("Wifi Clients")').last().text(),
    $('.info-box:contains("Wifi Clients")').find('.info-box-number').text(),
    $('.small-box:contains("Wifi Clients")').find('h3, .inner h3').text(),
    $('*:contains("Active Users")').last().parent().text(),
    $('*:contains("Active Users")').last().text(),
    $('.info-box:contains("Active Users") .info-box-number').first().text(),
    $('.small-box:contains("Active Users") .inner h3').first().text(),
    $('#active-users').text(),
    $('.active-users').first().text(),
    $('div:contains("Online Users")').next().text(),
    $('*:contains("Connected Clients")').last().parent().text(),
  ].filter(Boolean);

  let activeUsers = 0;
  for (const candidate of activeUserCandidateTexts) {
    const cleaned = candidate.replace(/[^0-9]/g, '');
    const amount = parseInt(cleaned, 10);
    if (!Number.isNaN(amount)) {
      activeUsers = amount;
      break;
    }
  }

  return { incomeAmount, activeUsers };
}

function deviceStillExists(deviceId: number) {
  const row = selectDeviceIdStatement.get(deviceId) as { id: number } | undefined;
  return Boolean(row);
}

function writeScrapeLog(deviceId: number, status: 'success' | 'fail', message: string) {
  if (!deviceStillExists(deviceId)) {
    console.log(`[Scraper] Skipping scrape log for deleted device ${deviceId}`);
    return;
  }

  insertScrapeLogStatement.run(deviceId, status, message);
}

const cryptoJsonFormatter = {
  stringify(cipherParams: CryptoJS.lib.CipherParams) {
    const jsonObj: Record<string, string> = {
      ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64),
    };

    if (cipherParams.iv) {
      jsonObj.iv = cipherParams.iv.toString();
    }

    if (cipherParams.salt) {
      jsonObj.s = cipherParams.salt.toString();
    }

    return JSON.stringify(jsonObj);
  },
  parse(jsonStr: string) {
    const jsonObj = JSON.parse(jsonStr);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(jsonObj.ct),
    });

    if (jsonObj.iv) {
      cipherParams.iv = CryptoJS.enc.Hex.parse(jsonObj.iv);
    }

    if (jsonObj.s) {
      cipherParams.salt = CryptoJS.enc.Hex.parse(jsonObj.s);
    }

    return cipherParams;
  },
};

async function fetchStatsPage(client: ReturnType<typeof wrapper>, baseUrl: string) {
  const statsUrls = [...new Set([
    getPrimaryStatsUrl(baseUrl),
    `${baseUrl}/system`,
    `${baseUrl}/dashboard`,
    `${baseUrl}/admin/dashboard`,
    `${baseUrl}/admin/`,
  ])];

  for (const statsUrl of statsUrls) {
    try {
      console.log(`[Scraper] Fetching stats from: ${statsUrl}`);
      const res = await client.get(statsUrl, {
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true,
      });

      const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      console.log(`[Scraper] Stats fetch status: ${res.status}`);

      if (res.status === 200 && looksLikeStatsPage(html)) {
        return { url: statsUrl, html };
      }
    } catch (err: any) {
      console.log(`[Scraper] Stats fetch error for ${statsUrl}: ${err.message}`);
    }
  }

  return null;
}

async function attemptFormLogin(client: ReturnType<typeof wrapper>, baseUrl: string, device: any) {
  const loginPageUrls = [...new Set([
    `${baseUrl}/`,
    `${baseUrl}/auth/signin/`,
    `${baseUrl}/auth/signin/?url=${encodeURIComponent(getPrimaryStatsUrl(baseUrl))}`,
    `${baseUrl}/signin/`,
    `${baseUrl}/login/`,
    `${baseUrl}/admin/`,
    `${baseUrl}/admin/login`,
    `${baseUrl}/admin/login/`,
  ])];

  for (const loginPageUrl of loginPageUrls) {
    try {
      console.log(`[Scraper] Inspecting login page: ${loginPageUrl}`);
      const pageRes = await client.get(loginPageUrl, {
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true,
      });

      if (pageRes.status >= 400) {
        continue;
      }

      const html = typeof pageRes.data === 'string' ? pageRes.data : JSON.stringify(pageRes.data);
      if (looksLikeStatsPage(html)) {
        console.log(`[Scraper] ${loginPageUrl} already exposes the stats page`);
        return {
          success: true as const,
          statsPage: { url: loginPageUrl, html },
        };
      }

      const $ = cheerio.load(html);
      const passwordField = $('input[type="password"]').first();
      if (!passwordField.length) {
        continue;
      }

      const form = passwordField.closest('form');
      const submitUrl = toAbsoluteUrl(loginPageUrl, form.attr('action') || loginPageUrl);
      const method = (form.attr('method') || 'post').toLowerCase();
      const hasCaptchaChallenge = form.find('input[name="captcha"]').length > 0;

      if (hasCaptchaChallenge) {
        return {
          success: false as const,
          error: `Login at ${loginPageUrl} requires a CAPTCHA challenge, so the scraper cannot automatically open ${getPrimaryStatsUrl(baseUrl)}`,
        };
      }

      const fields = new URLSearchParams();
      let usernameAssigned = false;
      let passwordAssigned = false;
      const asinValue = $('#asin').attr('value') || '';
      const usesEncryptedLogin = html.includes('CryptoJS.AES.encrypt') && Boolean(asinValue);

      form.find('input').each((_, input) => {
        const element = $(input);
        const name = element.attr('name');
        const type = (element.attr('type') || 'text').toLowerCase();
        const value = element.attr('value') || '';

        if (!name) {
          return;
        }

        if (usesEncryptedLogin && name === 'password') {
          return;
        }

        if (type === 'password') {
          fields.set(name, device.password);
          passwordAssigned = true;
          return;
        }

        if (!usernameAssigned && /(user(name)?|login|email)/i.test(name)) {
          fields.set(name, device.username);
          usernameAssigned = true;
          return;
        }

        if (type === 'hidden' || value) {
          fields.set(name, value);
        }
      });

      if (!usernameAssigned) {
        fields.set('username', device.username);
      }

      if (!passwordAssigned) {
        fields.set('password', device.password);
      }

      if (usesEncryptedLogin) {
        fields.delete('password');
        const cipher = CryptoJS.AES.encrypt(
          JSON.stringify({ username: device.username, password: device.password }),
          asinValue,
          { format: cryptoJsonFormatter },
        ).toString();
        fields.set('username', device.username);
        fields.set('cipher', cipher);
      }

      console.log(`[Scraper] Attempting form login via ${submitUrl}`);
      const loginRes =
        method === 'get'
          ? await client.get(`${submitUrl}?${fields.toString()}`, {
              timeout: REQUEST_TIMEOUT,
              validateStatus: () => true,
              headers: { Referer: loginPageUrl },
            })
          : await client.post(submitUrl, fields, {
              timeout: REQUEST_TIMEOUT,
              validateStatus: () => true,
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Referer: loginPageUrl,
              },
            });

      const responseText =
        typeof loginRes.data === 'string'
          ? loginRes.data.toLowerCase()
          : JSON.stringify(loginRes.data).toLowerCase();

      if (LOGIN_ERROR_PATTERNS.some((pattern) => responseText.includes(pattern))) {
        console.log(`[Scraper] Login attempt returned an auth error at ${submitUrl}`);
        continue;
      }

      const loginHtml =
        typeof loginRes.data === 'string' ? loginRes.data : JSON.stringify(loginRes.data);
      if (looksLikeStatsPage(loginHtml)) {
        console.log(`[Scraper] Login succeeded and returned stats via ${submitUrl}`);
        return {
          success: true as const,
          statsPage: { url: submitUrl, html: loginHtml },
        };
      }

      const statsPage = await fetchStatsPage(client, baseUrl);
      if (statsPage) {
        console.log(`[Scraper] Login succeeded via ${submitUrl}`);
        return { success: true as const, statsPage };
      }

      const followUp = await client.get(getPrimaryStatsUrl(baseUrl), {
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true,
      });
      const followUpHtml =
        typeof followUp.data === 'string' ? followUp.data : JSON.stringify(followUp.data);

      if (followUp.status === 302 || looksLikeLoginPage(followUpHtml)) {
        return {
          success: false as const,
          error: `Login rejected for username "${device.username}" at ${getPrimaryStatsUrl(baseUrl)}`,
        };
      }
    } catch (err: any) {
      console.log(`[Scraper] Login flow error for ${loginPageUrl}: ${err.message}`);
    }
  }

  return {
    success: false as const,
    error: `Could not authenticate or locate a compatible admin stats page at ${getPrimaryStatsUrl(baseUrl)}`,
  };
}

async function scrapeDeviceInternal(deviceId: number) {
  const device = selectDeviceStatement.get(deviceId) as any;
  if (!device) return { success: false, error: 'Device not found' };

  try {
    const baseUrl = normalizeBaseUrl(device.zerotier_ip);
    console.log(`[Scraper] Starting scrape for device ${deviceId} at ${baseUrl}`);

    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar, validateStatus: () => true }));

    let statsPage = await fetchStatsPage(client, baseUrl);
    if (!statsPage) {
      const loginAttempt = await attemptFormLogin(client, baseUrl, device);
      if (!loginAttempt.success) {
        throw new Error(loginAttempt.error);
      }

      statsPage = loginAttempt.statsPage ?? await fetchStatsPage(client, baseUrl);
      if (!statsPage) {
        throw new Error(`Logged in but could not load the admin stats page at ${getPrimaryStatsUrl(baseUrl)}`);
      }
    }

    const { incomeAmount, activeUsers } = parseStats(statsPage.html);
    const today = getAppDateString();
    const metadata = JSON.stringify({ source: 'scrape', statsUrl: statsPage.url });

    const existingLog = selectIncomeLogStatement.get(device.id, today) as { id: number, amount: number } | undefined;
    if (existingLog) {
      const storedAmount = Number(existingLog.amount) || 0;
      const nextAmount = Math.max(storedAmount, incomeAmount);
      updateIncomeLogStatement.run(nextAmount, metadata, device.id, today);
    } else {
      insertIncomeLogStatement.run(device.id, incomeAmount, today, metadata);
    }

    if (deviceStillExists(device.id)) {
      markDeviceOnlineStatement.run(activeUsers, device.id);
    }

    console.log(`[Scraper] Device ${deviceId} scrape success: PHP ${incomeAmount}, Active Users: ${activeUsers}`);
    writeScrapeLog(device.id, 'success', `Scraped daily income: PHP ${incomeAmount}, Active Users: ${activeUsers}`);

    return { success: true, amount: incomeAmount, activeUsers };
  } catch (err: any) {
    let errorMsg = err.message || 'Unknown scrape error';
    if (err.response) {
      errorMsg = `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
    }

    console.log(`[Scraper] Device ${deviceId} scrape failed: ${errorMsg}`);
    if (deviceStillExists(device.id)) {
      markDeviceOfflineStatement.run(device.id);
    }
    writeScrapeLog(device.id, 'fail', errorMsg);

    return { success: false, error: errorMsg };
  }
}

export async function scrapeDevice(deviceId: number) {
  const existingPromise = inFlightDeviceScrapes.get(deviceId);
  if (existingPromise) {
    return existingPromise;
  }

  const scrapePromise = scrapeDeviceInternal(deviceId)
    .finally(() => {
      inFlightDeviceScrapes.delete(deviceId);
    });

  inFlightDeviceScrapes.set(deviceId, scrapePromise);
  return scrapePromise;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  if (items.length === 0) {
    return [] as R[];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

export async function scrapeAllDevices() {
  if (inFlightAllScrape) {
    return inFlightAllScrape;
  }

  inFlightAllScrape = (async () => {
    const devices = selectDeviceIdsStatement.all() as { id: number }[];
    return runWithConcurrency(devices, SCRAPE_CONCURRENCY, (device) => scrapeDevice(device.id));
  })().finally(() => {
    inFlightAllScrape = null;
  });

  return inFlightAllScrape;
}
