module.exports = {
    install,
};

function install() {
    if( process.env['NODE_ENV'] !== 'production' ) {
        return;
    }
    const env = require('../util/env');
    require('assert')(env.SENTRY_KEY);
    var Raven = require('raven');
    Raven.config('https://'+env.SENTRY_KEY+'@sentry.io/122313').install();
}

