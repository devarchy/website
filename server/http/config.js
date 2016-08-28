const env = require('../util/env');

module.exports = {
    host: undefined, // let hapi figure out the right IP address on the server
    port: 8081,
    protocol: 'http://',
    dev_client: {
        host: 'localhost',
        port: 8082,
        protocol: 'http://'
    }
};
