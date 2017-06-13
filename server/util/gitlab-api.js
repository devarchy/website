"use strict";
const assert = require('assertion-soft');
const assert_soft = require('assertion-soft');
const assert_hard = require('assertion-soft/hard');
const env = require('./env');
const fetch_with_cache = require('./fetch_with_cache');
const {b64DecodeUnicode} = require('./b64_unicode');

module.exports = {
    repo: {
        get_readme,
    },
    url: 'https://gitlab.com/',
};

const PROJECTS_ID_MAP = {
    'brillout/awesome-react-components': '3298016',
};

function get_readme({
    full_name,
    max_delay,
    markdown_parsed,
    cache__entry_expiration,
    branch='master',
}) {
    assert(full_name);
    assert(markdown_parsed===false);

    // - https://gitlab.com/help/api/repository_files.md
    // - 'https://gitlab.example.com/api/v4/projects/13083/repository/files/app%2Fmodels%2Fkey%2Erb?ref=master'
    return (
        request({
            full_name,
            path: '/repository/files/readme.md',
            query_string: {
                ref: branch,
            }
        }, {
            max_delay,
            cache__entry_expiration,
        })
        .then(process_file_response)
    );
}

function request({full_name, path, query_string={}}, {max_delay, expected_error_status_codes, cache__entry_expiration}={}) { 

    const project_id = PROJECTS_ID_MAP[full_name];
    assert_hard(project_id, full_name);

    assert_hard(path.startsWith('/'), path);
    path = (
        '/projects/'+project_id+path
    );

    query_string.private_token = env.GITLAB_PRIVATE_TOKEN;

    const fetch_params = {
        url: 'https://gitlab.com/api/v4'+path,
        json: true,
        timeout: max_delay,
        expected_error_status_codes,
        query_string,
    };

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
        return resp.response_body;
    })
    .catch(resp => {
        assert(resp, resp);
        assert(resp.request_url, resp);
        assert(resp.stack, resp);
        throw resp;
    });
} 

function process_file_response(result) { 
    if( result === null ) return null;

    assert_soft(result.encoding==='base64');

    return b64DecodeUnicode(result.content);
} 


