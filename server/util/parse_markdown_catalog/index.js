const options = require('./util/options');
const log = require('./util/log');
const parse_markdown = require('./parse_markdown');
const linear_processors = require('./linear_processors');
const categorize = require('./categorize');
const choose_processor = require('./choose_processor');

handle_interface();

function parse_markdown_catalog(contents, {debug=false}={}) {

    options.debug = debug;
    contents = contents.toString();

    let linear_info = parse_markdown(contents);

    linear_info = linear_processors(linear_info);

    let categories = categorize(linear_info);

    categories = choose_processor(categories);

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
            const categories = parse_markdown_catalog(contents,{debug: false});
         // categories.forEach(c => {c.resources = c.resources.length});
            console.log(JSON.stringify(categories, null, 2));
        });
    }
} 

