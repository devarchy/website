const assert = require('assert');
const is_github_url = require('../../util/is_github_url');
const npm_package_name_validation = require('../../../npm_package_name_validation');


module.exports = {
    process,
    info_title: 'as_npm_package',
};


function process(type, raw_data) {
    if( type === 'link' ) {
        return process_link(raw_data);
    }
    return null;
}

function process_link(raw_data) {
    const link = raw_data.url;
    const text = raw_data.texts.inside;

    const github_full_name = is_github_url(link, {expect_correct_url: false});

    let npm_package_name = null;
    if( npm_package_name_validation.is_npm_package_name_valid(text) ) {
         npm_package_name = text;
    }

    if( !github_full_name || !npm_package_name ) {
        return null;
    }

    return {
        github_full_name,
        npm_package_name,
    };
}
