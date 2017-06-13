const assert = require('assert');
const assert_hard = require('assert');

const GITHUB_URL_START = 'https://github.com/';

module.exports = (url, {throw_on_wrong_url=true, correct_wrong_url=false, expect_correct_url=false, }={}) => {
    if( ! url.startsWith(GITHUB_URL_START) ) {
        return null;
    }
    const github_full_name = url.slice(GITHUB_URL_START.length);
    const url_is_correct = github_full_name.split('/').length === 2;
    if( expect_correct_url && ! url_is_correct ) {
        const msg = 'Losing path information of `'+github_full_name+'`';
        if( throw_on_wrong_url !== false ) {
            assert_hard(false, msg);
        } else {
            console.warn(msg);
        }
    }
    if( url_is_correct ) {
        return github_full_name;
    }
    if( correct_wrong_url ) {
        return github_full_name.split('/').slice(0,2).join('/');
    }
    return null;
};
