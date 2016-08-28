const hapi = require('hapi');
const auth = require('./auth');
const api = require('./api');
const client = require('./client');
const config = require('./config');
const log = require('./log');


const server = new hapi.Server();
server.connection(connection());
server.register(plugins(), callback);


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

    auth(server);

    api(server);

    client(server);

    server.start(_ => console.log('Server running at:', server.info.uri));
}

// gloabl.server_uri = server.info.uri;
