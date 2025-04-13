var http = require('http');
var url = require('url');
const { parse } = require('querystring');
var fs = require('fs');

// Metrics: prom-client and express
const client = require('prom-client');
const express = require('express');
const metricsApp = express();

// Config
const config = require('./config/config.json');
const defaultConfig = config.development;
global.gConfig = defaultConfig;

// Setup metrics
client.collectDefaultMetrics();

// HTTP Request Counter
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Active Resources Gauge
const activeResourcesGauge = new client.Gauge({
  name: 'active_resources',
  help: 'Number of active resources'
});
setInterval(() => {
	activeResourcesGauge.set(process._getActiveHandles().length);
}, 10000);

// Expose /metrics via separate Express server
metricsApp.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
metricsApp.listen(22138, () => {
  console.log('Metrics server running on port 22138');
});

// HTML layout
var header = '<!doctype html><html><head>';
var body = '</head><body><div id="container"><div id="logo">' + global.gConfig.app_name + 'Dev</div><div id="space"></div><div id="form"><form id="form" action="/" method="post"><center><label class="control-label">Name:</label><input class="input" type="text" name="name"/><br /><label class="control-label">Ingredients:</label><input class="input" type="text" name="ingredients" /><br /><label class="control-label">Prep Time:</label><input class="input" type="number" name="prepTimeInMinutes" /><br />';
var submitButton = '<button class="button button1">Submit</button></div></form>';
var endBody = '</div></body></html>';

// Main HTTP Server
http.createServer(function (req, res) {
  console.log(req.url);

  // Increment metric here
  res.on('finish', () => {
    httpRequestCounter.inc({ method: req.method, route: req.url, status_code: res.statusCode });
  });

  if (req.url === '/favicon.ico') {
    res.writeHead(200, { 'Content-Type': 'image/x-icon' });
    res.end();
    console.log('favicon requested');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  var fileContents = fs.readFileSync('./public/default.css', { encoding: 'utf8' });
  res.write(header);
  res.write('<style>' + fileContents + '</style>');
  res.write(body);
  res.write(submitButton);

  const http = require('http');
  var timeout = 0;

  if (req.method === 'POST') {
    timeout = 2000;
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      var qs = require('querystring');
      var post = qs.parse(body);
      var myJSONObject = {
        name: post["name"],
        ingredients: post["ingredients"].split(','),
        prepTimeInMinutes: post["prepTimeInMinutes"]
      };

      const options = {
        hostname: global.gConfig.webservice_host,
        port: global.gConfig.webservice_port,
        path: '/recipe',
        method: 'POST',
        json: true,
      };

      const req2 = http.request(options, (resp) => {
        resp.on('data', () => {});
        resp.on('end', () => { console.log("Data Saved!"); });
      });
      req2.setHeader('content-type', 'application/json');
      req2.write(JSON.stringify(myJSONObject));
      req2.end();
    });
  }

  if (req.method === 'POST') {
    res.write('<div id="space"></div>');
    res.write('<div id="logo">New recipe saved successfully! </div>');
    res.write('<div id="space"></div>');
  }

  setTimeout(() => {
    const options = {
      hostname: global.gConfig.webservice_host,
      port: global.gConfig.webservice_port,
      path: '/recipes',
      method: 'GET',
    };

    const req3 = http.request(options, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        res.write('<div id="space"></div>');
        res.write('<div id="logo">Your Previous Recipes</div>');
        res.write('<div id="space"></div>');
        res.write('<div id="results">Name | Ingredients | PrepTime');
        res.write('<div id="space"></div>');

        const myArr = JSON.parse(data);
        for (let i = 0; i < myArr.length; i++) {
          res.write(myArr[i].name + ' | ' + myArr[i].ingredients + ' | ' + myArr[i].prepTimeInMinutes + '<br/>');
        }

        res.write('</div><div id="space"></div>');
        res.end(endBody);
      });
    });
    req3.end();
  }, timeout);

}).listen(global.gConfig.exposedPort, '0.0.0.0', () => {
  console.log(`Server running on port ${global.gConfig.exposedPort}`);
});
