"use strict";
const http = require('request-promise');
const assert = require('assert');
// don't use isomorphic fetch until abort or timeout has been implemented
// - https://github.com/github/fetch/issues/131
// - https://github.com/github/fetch/issues/246
const Promise = require('bluebird');
Promise.longStackTraces();
const atob = require('atob');
const env = require('./env');
const long_term_cache = require('./long_term_cache');
const NetworkConnectionError = require('./network_connection_error');
const http_node = require('http');


module.exports = {
    repo: {
        get_info: get_repository_info,
        get_package_json,
        get_readme,
    },
    user: {
        get_info: get_user_info,
        get_emails: get_user_emails,
    },
    url: 'https://github.com/',
};

const http_pool = new http_node.Agent({maxSockets: 10, keepAlive: true});

const credentials = {
    client_id: env.GITHUB_CLIENT_ID,
    client_secret: env.GITHUB_CLIENT_SECRET,
};

const http_cached = long_term_cache({ 
    function_to_cache: http,
    hash_input: req => { return req.method + ' ' + req.uri + (req.accept_header ? (' ' + req.accept_header) : '') },
    entry_expiration: 1000*60*60*24*10,
    cache_name: 'http',
    parse_output: (response, output_is_error) => {

        // `require-promise` sometimes doesn't seem to return properly
        assert(Object.keys(response||{}).length>0, '`response==='+response+'`');

        return parse(response, output_is_error);

        function parse({body, error, headers, statusCode, response, request}, output_is_error) {

            // `require-promise` sometimes doesn't seem to return properly
            assert(!output_is_error || Object.keys(response||{}).length>0 || Object.keys(error||{}).length>0, '`output_is_error==='+output_is_error+'`, `response==='+response+'`, `statusCode==='+statusCode+'`, `error==='+JSON.stringify(error, null, 2)+'`');

            response = output_is_error && response ? parse(response) : null;

            return {body, error, headers, statusCode, response, request};
        }

    },
    ignore_cache_entry: ({statusCode,error}={}) => (
        statusCode===403 || // 403 -> API rate limit exceeded
        !statusCode || !error ||
        NetworkConnectionError.check_error_object(error)
    ),
}); 

function get_user_info({login, max_delay}) {
    return request({path: 'users/'+login, max_delay});
}

function get_user_emails({auth_token, max_delay}) {
    assert(auth_token);
    return request({path: 'user/emails?access_token='+auth_token, max_delay});
}

function get_repository_info({full_name, max_delay, expected_status_codes}) {
    return request({path: 'repos/'+full_name, max_delay, expected_status_codes});
}

function get_package_json({full_name, max_delay}) { 
    return get_file({full_name, file_path: 'package.json', max_delay}).then(content => {
        try {
            return JSON.parse(content);
        }catch(e) {
            // we can't assume that package.json is well formated
            return null;
        }
    });
} 

function get_readme({full_name, max_delay, markdown_parsed=true}) { 
    const path = 'repos/' + full_name + '/readme';
    const req_obj = {path, max_delay, expected_status_codes: [404]};
    if( markdown_parsed ) {
        req_obj.accept_header = 'application/vnd.github.html';
    }
    return request(req_obj)
    .then(result => {
        if( ! markdown_parsed ) {
            return process_file_result(result);
        }
        if( result === null ) return null;
        return result;
    });
} 

function get_file({full_name, file_path, dir='contents/', max_delay, accept_header}) { 
    const path =
        'repos/' +
        full_name +
        '/' +
        dir +
        file_path;
    return request({path, max_delay, expected_status_codes: [404], accept_header})
    .then(process_file_result)
} 

function process_file_result(result) { 
    if( result === null ) return null;
    return atob(result.content);
} 

function request({path, max_delay, expected_status_codes, accept_header}) { 

    return (
        wrap_promise(
            call_http({accept_header})
        )
    )
    .then(resp => {
        if( ! resp._comes_from_cache ) {
            const rate_remaining = resp.headers['x-ratelimit-remaining'];
            if( ! (rate_remaining > 2000) && (rate_remaining % 500 === 50) ) {
                console.warn('\nLow '+get_api_rate_stats(resp)+'\n');
            }
        }
        return resp.body;
    })
    .catch(err => {
        if( ! NetworkConnectionError.check_error_object(err) && !(err.statusCode || err.error || err.response) ) {
            console.error('unexpected error;');
            console.error(err);
            throw err;
        }
        if( (expected_status_codes||[]).includes(err.statusCode) ) {
            return null;
        }
        if( ! NetworkConnectionError.check_error_object(err) ) {
            console.error('\n');
            console.error(err.statusCode + ' ' + (err.error||{}).message);
            console.error(err.response.request.uri.pathname);
            console.error(get_api_rate_stats(err.response));
            console.error('\n');
        }
        throw err;
    });

    function get_api_rate_stats(resp){
        const rate_limit = resp.headers['x-ratelimit-limit'];
        const rate_remaining = resp.headers['x-ratelimit-remaining'];
        const rate_reset = Math.ceil((resp.headers['x-ratelimit-reset']*1000 - new Date()) / (1000*60));
        return 'API rate: '+rate_remaining+'/'+rate_limit+' (Reset: '+rate_reset+'mn)';
    }

    function call_http({accept_header}={}) {

        const params = {
            method: 'GET',
            qs: credentials,
            uri: 'https://api.github.com/'+path,
            withCredentials: false,
            json: true,
            headers: {
                'User-Agent': 'devarchy',
            },
            resolveWithFullResponse: true,
            pool: http_pool,
        };

        if( accept_header ) {
            params.headers['Accept'] = accept_header;
        }

        return http_cached(params);

    }

    function wrap_promise(request_promise) {

        assert((request_promise.abort||1).constructor === Function);

        return new Promise((resolve, reject) => {
            let is_finished = false;

            request_promise
            .then(resp => {
                if( is_finished ) return;
                is_finished = true;
                resolve(resp);
            })
            .catch(err => {
                if( ! err.error ) {
                    // this is unexpected and needs dev attention
                    console.error('unexpected error;');
                    console.error(err);
                    throw err;
                }
                if( is_finished ) return;
                is_finished = true;
                const connection_problem = NetworkConnectionError.check_error_object(err.error);
                if( connection_problem ) {
                    reject(new NetworkConnectionError("Could not connect to GitHub's API: "+connection_problem));
                }
                reject(err);
            });

            if( max_delay ) {
                setTimeout(() => {
                    if( is_finished ) return;
                    is_finished = true;
                    request_promise.abort();
                    // upon `abort()` promise won't be resolved nor rejected
                    reject(new NetworkConnectionError("Could not connect to GitHub's API; timeout of "+max_delay+"ms reached"));
                }, max_delay);
            }

        });

    }
} 
