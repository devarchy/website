const assert = require('assert');


module.exports = {
    process,
    desc: 'as_npm_catalog',
};


function process(type, raw_data) {
    if( type === 'link' ) {
        return process_link(raw_data);
    }
    if( type === 'header') {
        return null;
    }
    if( type === 'description') {
        return null;
    }
}

function process_link(raw_data) { 
    const link = raw_data.url;
    const text = raw_data.texts.inside;

    let github_full_name = null;
    {
        const github_url_start = 'https://github.com/';
        if( link.startsWith(github_url_start) ) {
            github_full_name = link.slice(github_url_start.length);
            assert(github_full_name.split('/').length === 2, github_full_name);
        }
    }

    let npm_package_name = null;
    if( github_full_name && is_npm_package_name(text) ) {
         npm_package_name = text;
    }

 // assert( (github_full_name===null) === (npm_package_name===null), "`text==='"+text+"' && link==='"+link+"'`" );
    if( !github_full_name || !npm_package_name ) {
        return null;
    }

    return {
        github_full_name,
        npm_package_name,
    };

    function is_npm_package_name(npm_package_name) {
        return (
            /^[a-zA-Z0-9\-\.\_]+$/.test(npm_package_name) &&
            /^[a-zA-Z0-9]/.test(npm_package_name) &&
            /[a-zA-Z0-9]$/.test(npm_package_name)
        );
    }
} 
