const fetch = require('./fetch_with_cache');
const assert = require('assert');
const is_npm_package_name_valid = require('./npm_package_name_validation').is_npm_package_name_valid;


module.exports = {
    get_package_json: npm_package_name => retrive_package_json(npm_package_name),
    url: 'https://www.npmjs.com/package/',
    is_npm_package_name_valid,
};

function retrive_package_json(npm_package_name) { 
    const url = 'http://registry.npmjs.org/'+encodeURIComponent(npm_package_name).replace(/^%40/, '@');

    return (
        fetch({
            url,
            json: true,
            pushy: true,
        })
        .then(resp => {
            assert(
                resp,
                [
                    'npm_package_name: '+npm_package_name,
                    'resp: '+resp,
                ].join('\n')
            );
            assert(resp.response_body, npm_package_name);
            return resp.response_body;
        })
    );
} 
