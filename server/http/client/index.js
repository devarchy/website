const assert_soft = require('assertion-soft');
const timerlog = require('timerlog');


module.exports = function(server) {
    server.route({
        method: 'GET',
        path: '/',
        handler,
    });
    server.route({
        method: 'GET',
        path: '/{param*}',
        handler,
    });
};


{
    let html;
    if( process.env['NODE_ENV'] === 'production' ) {
        html = require('./html');
    }
    function handler(request, reply) {
        const pathname = request.url.pathname;
        assert_soft(pathname);

        const log_id__overall = timerlog({ 
            start_timer: true,
            message: "HTML computed for "+pathname,
            tags: ["http_request", "new_visit"],
        }); 

        // `require('./html')` loads whole machinery to compiles client side code
        // -> we therefore `require('./html')` only when we need to
        html = require('./html');

        const {production_url, hostname} = (() => {
            const headers = request.headers;

            const host = headers.host;
            assert_soft(host, headers);
            assert_soft(request.info.host===host, headers, request.info.host);

            let hostname = (host||'').split(':')[0].toLowerCase();
         // assert_soft(['devarchy.com', 'localhost', '52.37.197.83', ].includes(hostname), '`hostname===`'+hostname);
            const expected_hosts = ['devarchy.com', 'localhost'];
            hostname = expected_hosts.includes(hostname) ? hostname : expected_hosts[0];
         // console.log(require('circular-json').stringify(Object.assign({}, request, {connection: null, server: null, _router: null, settings: null}), null, 2));

            const production_url = assert_soft(pathname[0]==='/') ? ('https://devarchy.com'+pathname) : null;

            return {production_url, hostname};
        })();

        html({pathname, hostname, production_url})
        .then(({html_str, redirect_to, return_status_code}) => {

            assert_soft(!return_status_code || return_status_code.constructor===Number, return_status_code);
            assert_soft(!redirect_to || return_status_code, redirect_to, return_status_code);
            assert_soft(!redirect_to || redirect_to.constructor===String && redirect_to[0]==='/', redirect_to);

            let rep = reply(html_str || undefined);

            if( redirect_to ) {
                assert_soft(redirect_to.constructor===String);
                rep = rep.redirect(redirect_to);
            }

            if( return_status_code ) {
                rep.code(return_status_code);
            }

            timerlog({ 
                id: log_id__overall,
                end_timer: true,
            }); 
        });
    }
}
