const hapi = require('hapi');
const auth = require('./auth');
const api = require('./api');
const client = require('./client');
const http_cache = require('./http_cache');
const static_dir = require('./static_dir');
const error_handler = require('./error_handler').error_handler;
const config = require('./config');
const log = require('./log');


const server = new hapi.Server();
server.connection(connection());

const bootup_promise = (
    server
    .register(plugins())
    .then(callback)
    .then(() => server)
);


module.exports = bootup_promise;

function connection() {
    return {
        host: config.host,
        port: config.port,
        routes: {
            cors: {
               origin: [
                   [
                       config.dev_client.protocol,
                       config.dev_client.host,
                       ':',
                       config.dev_client.port
                   ].join('')
               ],
               credentials: true
            }
        },
    };
}

function plugins() {
    return [
        require('bell'),
        require('inert'),
        require('hapi-auth-cookie'),
    ]
}

function callback(err) {
    if( err ) console.error('Failed to load a plugin:', err);

    log(server);

    static_dir(server);

    error_handler(server);

    http_cache(server);

    auth(server);

    api(server);

    client(server);

    return server.start();
}

// gloabl.server_uri = server.info.uri;
