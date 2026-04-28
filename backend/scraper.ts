import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';
import db from './db.js';
import { getAppDateString } from './time.js';

const REQUEST_TIMEOUT = 30000;
const LOGIN_ERROR_PATTERNS = [
  'invalid credentials',
  'incorrect',
  'failed csrf',
  'csrf',
  'login failed',
  'access denied',
];

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

function extractIncomeAmount(html: string) {
  const $ = cheerio.load(html);
  const candidateTexts = [
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

  for (const candidate of candidateTexts) {
    const cleaned = candidate.replace(/[^0-9.]/g, '');
    const amount = parseFloat(cleaned);
    if (!Number.isNaN(amount)) {
      return amount;
    }
  }

  return 0;
}

function deviceStillExists(deviceId: number) {
  const row = db.prepare('SELECT id FROM devices WHERE id = ?').get(deviceId) as { id: number } | undefined;
  return Boolean(row);
}

function writeScrapeLog(deviceId: number, status: 'success' | 'fail', message: string) {
  if (!deviceStillExists(deviceId)) {
    console.log(`[Scraper] Skipping scrape log for deleted device ${deviceId}`);
    return;
  }

  db.prepare('INSERT INTO scrape_logs (device_id, status, message) VALUES (?, ?, ?)')
    .run(deviceId, status, message);
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
  const statsUrls = [
    getPrimaryStatsUrl(baseUrl),
    `${baseUrl}/system`,
    `${baseUrl}/dashboard`,
    `${baseUrl}/admin/dashboard`,
    `${baseUrl}/admin/`,
  ];

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
  const loginPageUrls = [
    `${baseUrl}/`,
    `${baseUrl}/auth/signin/`,
    `${baseUrl}/auth/signin/?url=${encodeURIComponent(getPrimaryStatsUrl(baseUrl))}`,
    `${baseUrl}/signin/`,
    `${baseUrl}/login/`,
    `${baseUrl}/admin/`,
    `${baseUrl}/admin/login`,
    `${baseUrl}/admin/login/`,
  ];

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
        return { success: true as const };
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

      const statsPage = await fetchStatsPage(client, baseUrl);
      if (statsPage) {
        console.log(`[Scraper] Login succeeded via ${submitUrl}`);
        return { success: true as const };
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

export async function scrapeDevice(deviceId: number) {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
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

      statsPage = await fetchStatsPage(client, baseUrl);
      if (!statsPage) {
        throw new Error(`Logged in but could not load the admin stats page at ${getPrimaryStatsUrl(baseUrl)}`);
      }
    }

    const incomeAmount = extractIncomeAmount(statsPage.html);
    const today = getAppDateString();
    const metadata = JSON.stringify({ source: 'scrape', statsUrl: statsPage.url });

    const existingLog = db.prepare('SELECT id, amount FROM income_logs WHERE device_id = ? AND date = ?').get(device.id, today) as { id: number, amount: number } | undefined;
    if (existingLog) {
      const storedAmount = Number(existingLog.amount) || 0;
      const nextAmount = Math.max(storedAmount, incomeAmount);
      db.prepare('UPDATE income_logs SET amount = ?, raw_value = ?, created_at = CURRENT_TIMESTAMP WHERE device_id = ? AND date = ?')
        .run(nextAmount, metadata, device.id, today);
    } else {
      db.prepare('INSERT INTO income_logs (device_id, amount, date, raw_value) VALUES (?, ?, ?, ?)')
        .run(device.id, incomeAmount, today, metadata);
    }

    if (deviceStillExists(device.id)) {
      db.prepare("UPDATE devices SET status = 'online', last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(device.id);
    }

    console.log(`[Scraper] Device ${deviceId} scrape success: PHP ${incomeAmount}`);
    writeScrapeLog(device.id, 'success', `Scraped daily income: PHP ${incomeAmount}`);

    return { success: true, amount: incomeAmount };
  } catch (err: any) {
    let errorMsg = err.message || 'Unknown scrape error';
    if (err.response) {
      errorMsg = `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`;
    }

    console.log(`[Scraper] Device ${deviceId} scrape failed: ${errorMsg}`);
    if (deviceStillExists(device.id)) {
      db.prepare("UPDATE devices SET status = 'offline' WHERE id = ?").run(device.id);
    }
    writeScrapeLog(device.id, 'fail', errorMsg);

    return { success: false, error: errorMsg };
  }
}

export async function scrapeAllDevices() {
  const devices = db.prepare('SELECT id FROM devices').all() as { id: number }[];
  const results = [];
  for (const device of devices) {
    results.push(await scrapeDevice(device.id));
  }
  return results;
}
