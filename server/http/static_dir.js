const CLIENT_STATIC_DIR = require('path').join(__dirname, '../../client/dist/static/');

module.exports = function(server) {
    server.route({
        method: 'GET',
        path: '/static/{param*}',
        handler: {
            directory: {
                path: CLIENT_STATIC_DIR,
                index: [],
                etagMethod: false,
            }
        },
    });

};
