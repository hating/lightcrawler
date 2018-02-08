const cheerio = require('cheerio');
const ChildProcess = require('child_process');
const Crawler = require('simplecrawler');
const queue = require('async/queue');
const url = require('url');
const mkdirp = require('mkdirp');

const config = {
  settings: {
    crawler: {
      maxDepth: 5,
      maxChromeInstances: 5
    }
  }
};

module.exports = (options) => {

  // Initiate crawler
  const crawler = new Crawler(options.url);

  crawler.respectRobotsTxt = false;
  crawler.parseHTMLComments = false;
  crawler.parseScriptTags = false;
  crawler.maxDepth = config.settings.crawler.maxDepth || 1;

  crawler.discoverResources = (buffer) => {
    const page = cheerio.load(buffer.toString('utf8'));
    return links = page('a[href]').map(function () {
      return `${page(this).attr('href')}?#`.split('#')[0].split('?')[0];
    }).get();
  };


  const lighthouseQueue = queue((link, callback) => {
    runLighthouse(link, () => {
      callback()
    })
  }, config.settings.crawler.maxChromeInstances);

  crawler.on('fetchcomplete', (queueItem) => {
    lighthouseQueue.push(queueItem.url)
  });
  crawler.start();
};

function runLighthouse (link, callback) {
  let path = './reports'+url.parse(link).pathname;
  mkdirp.sync(path);

  const getTime = ()=>{
    return new Date().toLocaleString().replace(/\s+/g,'_');
  };

  const outputPath = `${path}/${path.split('/').pop()}_${getTime()}.html` ;
  const args = [
    link,
    `--output-path=${outputPath}`,
    '--disable-device-emulation',
    '--save-assets',
    // '--perf',
    '--chrome-flags=--headless --disable-gpu',
  ];

  const lighthousePath = require.resolve('lighthouse/lighthouse-cli/index.js');
  const lighthouse = ChildProcess.spawn(lighthousePath, args);

  lighthouse.once('close', () => {
    console.log(`URL>>> ${link} ======= outputPath>>> ${outputPath} `);
    callback();
  });
}