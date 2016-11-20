"use strict";
const assert = require('assert');
const atob = require('atob');
const env = require('./env');
const fetch = require('./fetch');
const fetch_with_cache = require('./fetch_with_cache');


module.exports = {
    repo: {
        get_info: get_repository_info,
        get_package_json,
        get_readme,
        get_file,
    },
    user: {
        get_info: get_user_info,
        get_emails: get_user_emails,
    },
    url: 'https://github.com/',
};


function get_user_info({login}) { 
    return (
        request({path: 'users/'+login}, arguments[0])
    );
} 

function get_user_emails({auth_token}) { 
    assert(auth_token);
    return request({path: 'user/emails?access_token='+auth_token}, arguments[0]);
} 

function get_repository_info({full_name}) { 
    return (
        request({path: 'repos/'+full_name}, arguments[0])
    );
} 

function get_package_json(args) { 
    args.file_path = 'package.json';
    return get_file(args).then(content => {
        try {
            return JSON.parse(content);
        }catch(e) {
            // we can't assume that package.json is well formated
            return null;
        }
    });
} 

function get_readme({full_name, markdown_parsed=true}) { 
    const path = 'repos/' + full_name + '/readme';
    const req_obj = {path};
    if( markdown_parsed ) {
        req_obj.accept_header = 'application/vnd.github.html';
    }
    return request(
        req_obj,
        Object.assign(arguments[0], {expected_error_status_codes: [404]})
    )
    .then(result => {
        if( ! markdown_parsed ) {
            return process_file_response(result);
        }
        if( result === null ) return null;
        return result;
    });
} 

function get_file({full_name, file_path, dir='contents/'}) { 
    const path =
        'repos/' +
        full_name +
        '/' +
        dir +
        file_path;
    return request({path}, Object.assign(arguments[0], {expected_error_status_codes: [404]}))
    .then(process_file_response)
} 

function process_file_response(result) { 
    if( result === null ) return null;
    return atob(result.content);
} 

function request({path, accept_header}, {max_delay, expected_error_status_codes, dont_use_cache}) { 

    const CREDENTIALS = {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
    };

    const headers = {
        'User-Agent': 'devarchy',
    };

    if( accept_header ) {
        headers['Accept'] = accept_header;
    }

    const fetch_params = {
        url: 'https://api.github.com/'+path,
        query_string: CREDENTIALS,
        json: true,
        timeout: max_delay,
        expected_error_status_codes,
        headers,
    };

    return (
        dont_use_cache ? fetch(fetch_params) : fetch_with_cache(fetch_params)
    )
    .then(resp => {
        assert(resp, resp);
        assert(resp.request_url, resp);
        assert(resp.response_status_code, resp);
        if( (expected_error_status_codes||[]).includes(resp.response_status_code) ) {
            return null;
        }
        assert(resp.response_headers, JSON.stringify(resp, null, 2));
        if( ! resp._comes_from_cache ) {
            const rate_remaining = resp.response_headers['x-ratelimit-remaining'];
            if( ! (rate_remaining > 2000) && (rate_remaining % 500 === 50) ) {
                console.warn('\nLow '+get_api_rate_stats(resp.response_headers)+'\n');
            }
        }
        return resp.response_body;
    })
    .catch(resp => {
        assert(resp, resp);
        assert(resp.request_url, resp);
        assert(resp.stack, resp);
        if( resp.response_headers ) {
            console.error(get_api_rate_stats(resp));
        }
        throw resp;
    });

    function get_api_rate_stats(headers) {
        const rate_limit = headers['x-ratelimit-limit'];
        const rate_remaining = headers['x-ratelimit-remaining'];
        const rate_reset = Math.ceil((headers['x-ratelimit-reset']*1000 - new Date()) / (1000*60));
        return 'API rate: '+rate_remaining+'/'+rate_limit+' (Reset: '+rate_reset+'mn)';
    }

} 
