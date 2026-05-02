const https = require('https');
const { execSync } = require('child_process');

const targetUrl = 'https://api.github.com/repos/Co2u/PisoWifi-centralize/tarball/main';

https.get(targetUrl, { headers: { 'User-Agent': 'Node.js' } }, (res) => {
  if (res.statusCode === 301 || res.statusCode === 302) {
    execSync(`npx -y wget -qO- ${res.headers.location} | tar xz --strip-components=1`, { stdio: 'inherit' });
  }
}).on('error', (err) => {
  console.error(err);
});
