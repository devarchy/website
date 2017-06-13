const assert = require('assert');
const options = require('./util/options');
const log = require('./util/log');
const parse_markdown = require('./parse_markdown');
const apply_processors = require('./linear_processing/apply_processors');
const categorize = require('./categorize');

handle_interface();

function parse_markdown_catalog(contents, {debug=false, mode='strict', categories_to_include, processors, entries_to_prune}={}) {
    ['strict', 'loose', 'silent'].includes(mode);

    options.debug = debug;
    contents = contents.toString();

    let linear_info = parse_markdown(contents);
    apply_processors(linear_info, processors);

    if( entries_to_prune ) {
        linear_info = linear_info.filter(entry => !entries_to_prune(entry));
    }

    const categories = categorize(linear_info, {mode, categories_to_include});

    if( mode!=='silent' ) {
        validate(categories);
    }

    log(JSON.stringify(categories, null, 2));

    return categories;
}

function handle_interface() { 
    if( require.main !== module ) {
        as_module();
    } else {
        as_cli();
    }

    return;

    function as_module() {
        module.exports = parse_markdown_catalog;
    }

    function as_cli() {
        const Promise = require('bluebird'); Promise.longStackTraces();
        const readFile = Promise.promisify(require("fs").readFile);
        if( process.argv.length !== 3 ) {
            throw new Error(process.argv.length<3?'missing argument':'too many arguments');
        }
        const path = process.argv[2];
        readFile(path)
        .then(contents => {
            const categories = parse_markdown_catalog(contents, {debug: false, mode: 'loose'});
         // categories.forEach(c => {c.resources = c.resources.length});
            console.log(JSON.stringify(categories, null, 2));
        });
    }
} 

function validate(categories) { 
    categories.forEach(category => {
        category.resources
        .forEach(resource => {

            assert(resource.as_website_url);

            assert(!resource.as_npm_package || resource.as_github_repository);

            // make sure that GitHub URLs are repositories
            assert(!resource.as_website_url.resource_url.startsWith('https://github.com') || resource.as_github_repository, JSON.stringify(resource, null, 2));

        });
    });

} 
