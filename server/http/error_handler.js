const assert_soft = require('assertion-soft');


module.exports = {
    error_handler,
    interpret_response,
};


function error_handler(server) {
    server.route({
        method: 'GET',
        path: '/favicon.ico',
        handler: (request, reply) => {
            reply(message_for_404(request.path));
        },
    });

    server.ext('onPreResponse', (request, reply) => {

        const {is_ok, is_internal_error, is_not_found} = interpret_response(request.response);

        if( is_ok ) {
            reply.continue();
            return;
        }

        if( is_internal_error ) {
            console.error('Server error:');
            console.error(request.response.stack);
            reply(message_for_5xx());
            return;
        }

        if( is_not_found ) {
            const path = request.path;
            console.log('Serving unexpected path; `'+path+'`');
            reply(message_for_404(path));
            return;
        }

        reply.continue();
        return;

    });
}


function interpret_response(response) {
    let is_not_found = false;
    let is_ok = false;
    let is_internal_error = false;
    let is_redirect = false;
    let is_forbidden = false;

    if( response.isBoom ) {
        if( response.isServer ) {
            is_internal_error = true;
        } else {
            is_not_found = true;
        }
    }

    {
     // assert_soft(response.statusCode === undefined, response.statusCode);
        const statusCode = (response.output||{}).statusCode || response.statusCode || -1;
        assert_soft(statusCode !== -1, response.output, response.statusCode);
        const is_2xx = 200 <= statusCode && statusCode <= 299;
        const is_302 = statusCode === 302;
        const is_301 = statusCode === 301;
        const is_401 = statusCode === 401;
        const is_400 = statusCode === 400;
        const is_404 = statusCode === 404;
        const is_500 = statusCode === 500;
        assert_soft(is_2xx || is_302 || is_301 || is_401 || is_400 || is_404 || is_500, statusCode);
        if( is_2xx ) {
            is_ok = true;
        }
        if( is_302 || is_301 ) {
            is_redirect = true;
        }
        if( is_401 || is_400 ) {
            is_forbidden = true;
        }
        assert_soft(is_404||is_400===is_not_found, statusCode);
        if( is_400 ) {
            is_not_found = false;
        }
        assert_soft(is_500===is_internal_error, statusCode);
    }

    const response_type = {
        is_not_found,
        is_internal_error,
        is_ok,
        is_redirect,
        is_forbidden,
    };

    assert_soft(is_forbidden || is_redirect || is_ok || is_not_found || is_internal_error, response_type);
    assert_soft(is_forbidden +  is_redirect +  is_ok +  is_not_found +  is_internal_error === 1, response_type);
    assert_soft(is_forbidden ^  is_redirect ^  is_ok ^  is_not_found ^  is_internal_error, response_type);

    return response_type;
}


var message_for_404;
var message_for_5xx;
{
    const mini_html = msg => `<!DOCTYPE html><html>${msg}</html>`;
    const link = (url, url_pretty) => `<a rel="nofollow" target='_blank' href="${url}"/>${url_pretty||url}</a>`;
    const contact_us = `<br/><br/><b>Contact Info</b/><br/>${link('https://twitter.com/brillout', '@brillout')}<br/>${link('mailto:devarchy-error@brillout.com', 'devarchy-error@brillout.com')}`;
    message_for_404 = function (request_path) {
        return mini_html(`Couldn't find document <code>${request_path}</code>.`+contact_us);
    }
    message_for_5xx = function () {
        return mini_html('Something went wrong.'+contact_us);
    }
}
