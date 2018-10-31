const browsers = require('./browsers');

const capabilities = browsers.map(browser => Object.assign({}, {browserName: browser.browser.toLowerCase()}, browser));

exports.config = {
    specs: [
        './test/specs/**/*.ts'
    ],
    capabilities,
    sync: true,
    logLevel: 'silent',
    coloredLogs: true,
    deprecationWarnings: true,
    bail: 0,
    screenshotPath: './errorShots/',
    baseUrl: 'http://localhost:8090',
    waitforTimeout: 20000,
    connectionRetryTimeout: 90000,
    connectionRetryCount: 3,
    services: ['browserstack'],
    user: process.env.BROWSERSTACK_USERNAME,
    key: process.env.BROWSERSTACK_ACCESSKEY,
    browserstackLocal: true,
    framework: 'jasmine',
    jasmineNodeOpts: {
        defaultTimeoutInterval: 60000
    },
    before: function () {
        require('ts-node/register');
    }
};
