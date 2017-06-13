const assert = require('assert');
const is_github_url = require('../../util/is_github_url');


module.exports = {
    process,
    info_title: 'as_github_repository',
};


function process(type, raw_data, options) {
    if( type === 'link' ) {
        return process_link(raw_data, options);
    }
    return null;
}

function process_link(raw_data, options={}) {
    const link = raw_data.url;

    if( raw_data.texts.before!=='' ) {
        return null;
    }

    const title = raw_data.texts.inside;
    if( !title ) {
        return null;
    }

    const github_full_name = is_github_url(link, {expect_correct_url: false, correct_wrong_url: options.correct_wrong_url});
    if( !github_full_name ) {
        return null;
    }

    return {
        github_full_name,
        title,
    };
}
