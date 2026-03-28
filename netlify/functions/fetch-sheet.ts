import { GoogleAuth } from 'google-auth-library';

interface SheetConfig {
  spreadsheetId: string;
  gid: string;
}

const getConfig = (source: string): SheetConfig | null => {
  switch (source) {
    case 'amazon':
      return {
        spreadsheetId: process.env.AMAZON_SPREADSHEET_ID || '',
        gid: process.env.AMAZON_GID || '0',
      };
    case 'walmart':
      return {
        spreadsheetId: process.env.WALMART_SPREADSHEET_ID || '',
        gid: process.env.WALMART_GID || '0',
      };
    case 'bonus_cal':
      return {
        spreadsheetId: process.env.MAIN_SPREADSHEET_ID || '',
        gid: '1134944905',
      };
    case 'monthly_earning':
      return {
        spreadsheetId: process.env.MAIN_SPREADSHEET_ID || '',
        gid: '1636678788',
      };
    case 'posts':
      return {
        spreadsheetId: process.env.MAIN_SPREADSHEET_ID || '',
        gid: '1203420941',
      };
    default:
      return null;
  }
};

let authClient: GoogleAuth | null = null;

const getAuth = (): GoogleAuth | null => {
  if (authClient) return authClient;

  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;

  authClient = new GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return authClient;
};

// Fetch via Sheets API (authenticated, works with private sheets)
const fetchWithAuth = async (config: SheetConfig): Promise<string> => {
  const auth = getAuth();
  if (!auth) throw new Error('Google auth not configured');

  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  const token = tokenRes.token;
  if (!token) throw new Error('Failed to get access token');

  // Use Sheets API to get all values, then convert to CSV
  // First, get sheet name from gid via spreadsheet metadata
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}?fields=sheets.properties`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Metadata fetch failed: ${metaRes.status}`);
  const meta = await metaRes.json() as { sheets: { properties: { sheetId: number; title: string } }[] };

  const sheet = meta.sheets.find(
    (s: { properties: { sheetId: number } }) => String(s.properties.sheetId) === config.gid
  );
  const sheetName = sheet?.properties?.title || 'Sheet1';

  // Fetch all values
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
  const valuesRes = await fetch(valuesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!valuesRes.ok) throw new Error(`Values fetch failed: ${valuesRes.status}`);
  const data = await valuesRes.json() as { values?: string[][] };

  // Convert to CSV
  const rows = data.values || [];
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
};

exports.handler = async (event: { queryStringParameters?: Record<string, string> }) => {
  const source = event.queryStringParameters?.source;
  if (!source) {
    return { statusCode: 400, body: 'Missing "source" parameter' };
  }

  const config = getConfig(source);
  if (!config) {
    return { statusCode: 400, body: `Unknown source: ${source}` };
  }
  if (!config.spreadsheetId) {
    return {
      statusCode: 500,
      body: `Spreadsheet ID not configured for source: ${source}. Set the environment variable.`,
    };
  }

  try {
    const csv = await fetchWithAuth(config);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
      body: csv,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`fetch-sheet error [${source}]:`, msg);
    return { statusCode: 500, body: `Failed to fetch sheet: ${msg}` };
  }
};
