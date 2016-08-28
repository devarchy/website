const hapi = require('hapi');
const assert = require('assert');
const config = require('./http/config');

const server = new hapi.Server();

assert(process.env.SERVER_DOWN);

server.connection({
    host: config.host,
    port: config.port,
});

server.route({
    method: 'GET',
    path: '/{path*}',
    handler: function (request, reply) {
        reply(process.env.SERVER_DOWN).code(503);
    }
});

server.start((err) => {
    if (err) {
        throw err;
    }
    console.log("Server down notice `"+process.env.SERVER_DOWN+"` shown at: "+server.info.uri);
});
