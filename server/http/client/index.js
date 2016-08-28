const CLIENT_DIST = require('path').join(__dirname, '../../../client/dist/');
const crypto = require('crypto');


module.exports = function(server) {
    server.route({
        method: 'GET',
        path: '/{param*}',
        handler: {
            directory: {
                path: CLIENT_DIST,
                index: [],
            }
        },
    });

    server.route({
        method: 'GET',
        path: '/favicon.ico',
        handler: (request, reply) => {
            // - avoid 404's
            // -> avoid whole server-side react rendering machinery to load
            reply('');
        }
    });

    server.ext('onPreResponse', (request, reply) => {
        if( request.response.isBoom && [403,404].indexOf((request.response.output||{}).statusCode) !== -1 ) {
            // `require('./html')` loads whole machinery to compiles client side code
            // -> we therefore `require('./html')` only when we need to
            const html = require('./html');
            html(request.url.pathname)
            .then(html_code => reply(html_code))
            .then(response => {
                response.etag(generate_etag(response.source));
                return response;
            });
        }
        else {
            reply.continue();
        }
    });
};


function generate_etag(str) {
    return crypto
        .createHash('md5')
        .update(str, 'utf8')
        .digest('base64')
        .replace(/=+$/, '')
}
