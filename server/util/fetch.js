// don't use isomorphic fetch until abort or timeout has been implemented
// - https://github.com/github/fetch/issues/131
// - https://github.com/github/fetch/issues/246
// - https://github.com/whatwg/fetch/issues/27
const Promise = require('bluebird'); Promise.longStackTraces();
const http_node = require('http');
const http_pool = new http_node.Agent({maxSockets: 10, keepAlive: true});
const assert = require('assert');
const chalk = require('chalk');
const turn_into_error_object = require('./turn_into_error_object');
const normalize_url = require('./normalize_url');


module.exports = fetch;

module.exports.hash_fetch_input = hash_fetch_input;

function fetch(args) {
    const {pushy, turn_https_to_http} = args;
    args.expected_error_status_codes = args.expected_error_status_codes||[];
    if( turn_https_to_http ) {
        let url = normalize_url.remove_http_protocol(args.url);
        url = normalize_url.ensure_protocol_existence(url);
        args.url = url;
    }

    let fetcher = fetch_with_request_promise;
 // let fetcher = fetch_with_got;

    fetcher = fetcher.bind(null, args);

    if( pushy ) {
        const temporary_error_status_codes = [
            503, // 503 -> temporary unavailable
            502, // 502 -> gateway received invalid response
        ];
        temporary_error_status_codes.forEach(code => args.expected_error_status_codes.push(code));
        fetcher = make_promise_pushy(
            fetcher,
            {
                retry_condition: resp => {
                    assert(resp, resp);
                    assert(resp.request_url, resp);
                    assert(resp.response_connection_error || resp.response_status_code, resp);
                    return (
                        ! resp.response_connection_error &&
                        temporary_error_status_codes.includes(resp.response_status_code)
                    );
                }
            }
        );
    }

    return fetcher();
}

function fetch_with_request_promise(request) {
    const {url, method='GET', headers, query_string, timeout, json, expected_error_status_codes} = request;

    const request_promise = require('request-promise');

    let promise =
        request_promise({
            method,
            qs: query_string,
            uri: url,
            withCredentials: false,
            json,
            headers,
            resolveWithFullResponse: true,
            pool: http_pool,
        });

    if( timeout ) {
        promise = timeout_promise({promise, timeout});
    }

    promise =
        promise
        .then(response => parse_response(response, request, false))
        .catch(response => parse_response(response, request, true));

    promise =
        promise
        .catch(resp => {
            assert(resp, resp);
            assert(resp.request_url, resp);
            assert(resp.stack, resp);
            if( (expected_error_status_codes||[]).includes(resp.response_status_code) ) {
                return Object.assign({}, resp);
            }
            if( ! resp.response_connection_error ) {
                console.error([
                    '',
                    'Fetch unexpected error:',
                    resp.response_status_code + ' ' + resp.response_error_code + ' ' + resp.response_error_message,
                    resp.request_method + ' ' + resp.request_url,
                    '',
                ].join('\n'));
            }
            throw resp;
        });

     /*
     promise =
        promise
        .catch(resp => log(resp, true))
        .then(resp => log(resp, false))
    const fetch_start_time = new Date();
    */

    return promise;

    function log(resp, throw_resp) { 
        assert(resp, url);
        const duration = new Date() - fetch_start_time;
        console.log([
            '',
            '[url] '+url,
            '[is-error] '+(throw_resp && JSON.stringify(resp).replace('\n\r',' - ')),
            '[duration] '+duration,
            '',
        ].join('\n'));
        if( throw_resp ) {
            assert(resp.stack, resp);
            throw resp;
        }
        return resp;
    } 

    function parse_response(response, request, is_error) { 
        let info;
        try {
            info = parse();
        } catch(err) {
            setTimeout(() => {
                console.error(chalk.bgMagenta("\nCouldn't handle following `request-promise` response"));
                console.error(chalk.bgMagenta("Error message:"));
                console.error(err.message);
                console.error(err);
                console.error(chalk.bgMagenta("Reponse object:"));
                try {
                    console.error(JSON.stringify(response, null, 2));
                } catch(e) {
                    try {
                        console.error(response);
                    } catch(e) {}
                }
                console.error(chalk.bgMagenta("===========\n"));
                throw new Error('Error handling `request-promise`, see logs above');
            }, 0);
        }

        if( is_error ) {
            throw turn_into_error_object(info, response);
        }
        return info;

        function parse() {
         // is_error && !response.response_connection_error && console.log('response [is-error:'+!!is_error+']', response);

            const request_headers = headers || null;

            const request_method = method;
            assert(request_method);

            const request_url = url;
            assert(request_url);

            const response_error_code = (() => {
                if( response.response_connection_error || ! is_error ) {
                    return null;
                }
                assert(response.error, response);
                const error_code = response.error.code || null;
            //  assert(error_code);
                return error_code;
            })();

            const response_connection_error = (() => {
                const subject = request_method+" "+request_url;
                if( response.response_connection_error ) {
                    return response.response_connection_error+" for "+subject;
                }
                if( (response.message||'').includes('Invalid URI') ) {
                    return "URL `"+request_url+"` seems to be malformatted";
                }
                const known_errors = [
                    'EAI_AGAIN',
                    'ECONNRESET',
                    'ETIMEDOUT',
                    'ENOTFOUND',
                    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', // some certificate error, not sure what it means exactly
                ];
                if( known_errors.includes(response_error_code) ) {
                    return "got `"+response_error_code+"` on `"+subject+"`";
                }
                return null;
            })();

            assert(!response_connection_error === !!response.statusCode);
            assert(!response_connection_error === !!(is_error?(response.response||{}):response).body);

            const response_error_message = (() => {
                if( ! is_error ) {
                    return null;
                }
                const error_message = response.toString();
                assert(error_message);
                return error_message;
            })();

            const response_status_code = (() => {
                if( response_connection_error ) {
                    return null;
                }
                const status_code = response.statusCode;
                assert(status_code);
                return status_code;
            })();

            const response_body = (() => {
                if( response_connection_error ) {
                    return null;
                }
                const body = is_error ? response.response.body : response.body;
                assert(body || body==='');
                return body;
            })();

            const response_headers = (() => {
                if( response.response_connection_error ) {
                    return null;
                }
                if( is_error ) {
                    return null;
                }
                const headers = response.headers || null;
             // assert(headers);
                return headers;
            })();

            return {
                request_headers,
                request_method,
                request_url,
                response_error_code,
                response_connection_error,
                response_error_message,
                response_status_code,
                response_body,
                response_headers,
            };
        }
    } 

    function timeout_promise({promise, timeout}) { 

        assert((promise.abort||1).constructor === Function);
        assert((timeout||{}).constructor === Number);

        return new Promise((resolve, reject) => {
            let is_finished = false;

            promise
            .then(resp => {
                if( is_finished ) return;
                is_finished = true;
                resolve(resp);
            })
            .catch(err => {
                if( is_finished ) return;
                is_finished = true;
                reject(err);
            });

            if( timeout ) {
                setTimeout(() => {
                    if( is_finished ) return;
                    is_finished = true;
                    promise.abort();
                    // upon `abort()` promise won't be resolved nor rejected
                    reject(turn_into_error_object({response_connection_error: "timeout of "+timeout+"ms reached"}));
                }, timeout);
            }
        });

    } 
}

/* got doesn't seem to to be able to handle https
function fetch_with_got({url, method, headers, query_string, timeout, json}) {
    const got = require('got');

    url = url.replace(/^https/, 'http');
    assert(!url.startsWith('https'))

    return (
        got(url, {
            method,
            query: query_string,
            json,
            headers,
            agent: http_pool,
        })
        .then(resp => {
            console.log('resp', resp);
            return resp;
        })
        .catch(err => {
            console.log('err', err);
            throw err;
        })
    );

}
*/

function make_promise_pushy(promise_fct, {retry_condition}) { 
    let attempts_left = 10;

    return run_attempt;

    function run_attempt() {
        if( --attempts_left === 0 ) {
            return promise_fct();
        }
        let already_resolved = false;
        return (
            promise_fct()
        )
        .then(ret => {
            if( retry_condition(ret) ) {
                return run_attempt();
            }
            already_resolved = true;
            return ret;
        })
        .catch(err => {
            if( ! already_resolved && retry_condition(err) ) {
                return run_attempt();
            }
            throw err;
        });
    }
} 

function hash_fetch_input({url, method='GET', headers}) { 
    assert(url && method);
    return (
        method + ' ' + url +
        (headers ? (' '+JSON.stringify(headers)) : '')
    );
} 
