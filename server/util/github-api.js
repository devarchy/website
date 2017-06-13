"use strict";
const assert = require('assert');
const assert_soft = require('assertion-soft');
const env = require('./env');
const fetch_with_cache = require('./fetch_with_cache');
const cheerio = require('cheerio');
const {b64DecodeUnicode} = require('./b64_unicode');


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
    request,
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

function get_readme({full_name, markdown_parsed=true, branch}) { 
    const path = 'repos/' + full_name + '/readme';
    const req_obj = {path};
    if( markdown_parsed ) {
        req_obj.accept_header = 'application/vnd.github.html';
    }
    if( branch ) {
        req_obj.query_string = {ref: branch};
    }
    return (
        request(
            req_obj,
            Object.assign(arguments[0], {expected_error_status_codes: [404]})
        )
        .then(result => {
            if( ! markdown_parsed ) {
                return process_file_response(result);
            }
            if( result === null ) return null;
            return result;
        })
        .then(result => correct_relative_urls(result))
    );

    function correct_relative_urls(html_str) {
        if( ! markdown_parsed ) {
            html_str;
        }
        if( ! html_str ) {
            return html_str;
        }

        const $ = cheerio.load(html_str);

        const dom = {
            select: (
                selector => {
                    const els = [];
                    $(selector).each((i, el) => els.push($(el)));
                    return els
                }
            ),
            get_attr: (
                (el, attr) => el.attr(attr)
            ),
            set_attr: (
                (el, attr, val) => el.attr(attr, val)
            ),
            get_tag_name: (
                el => el.get(0).tagName
            ),
        };

        make_urls_absolute({dom, github_full_name: full_name});

        make_urls_target_blank_and_nofollow({dom});

        return $.html();

        function make_urls_absolute({github_full_name, dom: {select, get_attr, set_attr, get_tag_name}}) { 
            absolutize('href', '#');
            absolutize('href', '/', 'blob/master');
            absolutize('href', '', 'blob/master/');
            absolutize('src', '', 'raw/master/');

            function absolutize(attr, url_prefix, base_url_suffix='') {
                const selector = (
                    url_prefix!=='' ? (
                        '['+attr+'^="'+url_prefix+'"]'
                    ) : (
                        '['+attr+']'
                    )
                );
                select(selector)
                .forEach(el => {

                    {
                        const tag_name = get_tag_name(el);
                        assert(tag_name);
                        assert_soft(['img', 'a'].includes(tag_name.toLowerCase()), tag_name);
                        if( !['img', 'a'].includes(tag_name.toLowerCase()) ) {
                            return;
                        }
                    }


                    const attr_val = get_attr(el, attr);
                    if( /https?:\/\//.test(attr_val) ) {
                        return;
                    }

                    set_attr(
                        el,
                        attr+'-original',
                        attr_val
                    );
                    set_attr(
                        el,
                        attr,
                        [
                            'https://github.com/',
                            github_full_name,
                            '/',
                            base_url_suffix,
                            attr_val,
                        ].join('')
                    );

                });
            }
        } 

        function make_urls_target_blank_and_nofollow({dom: {select, get_attr, set_attr, get_tag_name}}) { 
            select('a')
            .forEach(el => {
                set_attr(el, 'target', '_blank');
                set_attr(el, 'rel', 'nofollow');
            });
        } 
    }
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

    return b64DecodeUnicode(result.content);
} 

function request({path, accept_header, query_string}, {max_delay, expected_error_status_codes, cache__entry_expiration, use_oauth_access_token, make_as_anonymous}={}) { 

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

    if( use_oauth_access_token && ! make_as_anonymous ) {
        headers['Authorization'] = "token "+env.GITHUB_OAUTH_ACCESS_TOKEN;
    }

    const fetch_params = {
        url: 'https://api.github.com/'+path,
        json: true,
        timeout: max_delay,
        expected_error_status_codes,
        headers,
    };

    if( ! use_oauth_access_token && ! make_as_anonymous ) {
        assert_soft(CREDENTIALS.constructor===Object);
        fetch_params.query_string = Object.assign({}, fetch_params.query_string, CREDENTIALS)
    }

    if( query_string ) {
        assert_soft(query_string.constructor===Object);
        fetch_params.query_string = Object.assign({}, fetch_params.query_string, query_string)
    }

    const entry_expiration = (
        cache__entry_expiration ||
        7 * 24*60*60*1000
    );

    return (
        fetch_with_cache(
            Object.assign(
                {},
                fetch_params,
                {long_term_cache__args: {entry_expiration}}
            )
        )
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
