const interpret_response = require('./error_handler').interpret_response;
const timerlog = require('timerlog');
const assert_soft = require('assertion-soft');
const nodejs_hash = require('../util/nodejs_hash');


module.exports = http_cache;


function http_cache(server) {
    server.ext('onPreResponse', (request, reply) => {

        const {is_ok, is_internal_error, is_not_found} = interpret_response(request.response);
        if( !is_ok || is_internal_error || is_not_found ) {
            reply.continue();
            return;
        }

        {
            const method = request.method;
            assert_soft(['get', 'post', 'options', 'head', ].includes(method), method);
            if( method!=='get' ) {
                reply.continue();
                return;
            }
        }

        if( request.response.variety === 'file' ) {
            // setting to one year; http://stackoverflow.com/questions/7071763/max-value-for-cache-control-header-in-http
            // immutable support; http://stackoverflow.com/questions/41936772/which-browsers-support-cache-control-immutable
            const path = request.path;
            const is_in_static_path = path.startsWith('/static/');
            assert_soft(is_in_static_path);
            const expected_extensions = [
                'js',
                'css',
                'map',

                'ico',
                'svg',
                'png',

                'json',
                'webapp',
                'xml',

                'eot',
                'woff',
                'woff2',
                'ttf',
            ];
            const extension_is_expected = expected_extensions.includes(path.split('.').slice(-1)[0]);
            assert_soft(extension_is_expected, path);
            if( is_in_static_path && extension_is_expected ) {
                request.response.header('Cache-control', 'public, max-age=31536000, immutable');
            }
        } else {
            const src = request.response.source;
            assert_soft(src, request.path, request.response.source);
            if( src ) {
                timerlog({ 
                    id: 'hash_http_response',
                    tags: ['performance', 'db_processing'],
                    start_timer: true,
                }); 
                request.response.etag(nodejs_hash(src));
                timerlog({ 
                    id: 'hash_http_response',
                    end_timer: true,
                }); 
            }
        }

        reply.continue();

    });
}

