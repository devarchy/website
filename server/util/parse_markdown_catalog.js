const assert = require('assert');

// parsers providing location information:
// - https://github.com/wooorm/remark
// - https://github.com/jgm/commonmark.js
// - https://github.com/textlint/markdown-to-ast
const remark = require('remark');

let options={};

handle_interface();

function parse_markdown_catalog(contents, {processor, style, debug=false}={}) {

    options.debug = debug;
    contents = contents.toString();

    let linear_info = parse_markdown(contents);

    linear_info =
        linear_info
        .map(info => {
            style_processor = get_style_processor(style);
            if( style_processor ) {
                info.data = style_processor(info.type, info.data);
            }
            if( processor ) {
                info.data = processor(info.type, info.data);
            }
            return info;
        })
        .filter(info => !!info.data);

    const categories = retrieve_categories(linear_info);

    log(JSON.stringify(categories, null, 2));

    return categories;

}


function get_style_processor(style) { 
    const STYLE__NPM_CATALOG = 'npm_catalog';
    const STYLES = [STYLE__NPM_CATALOG, ];

    if( ! STYLES.concat(undefined).includes(style) ) {
        throw new Error("unknown style `"+style+"`");
    }

    if( style === STYLE__NPM_CATALOG ) {
        return style__npm_catalog__processor;
    }

    return null;
} 
function style__npm_catalog__processor(type, data) { 
    if( type === 'link' ) {
        data = process_link(data);
    }
    if( type === 'header') {
        data = process_header(data);
    }
    if( type === 'description') {
        data = process_description(data);
    }

    return data;

    function process_link(data) { 
        const link = data.url;
        const text = data.texts.inside;

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
            last_line: data.last_line,
        };

        function is_npm_package_name(npm_package_name) {
            return (
                /^[a-zA-Z0-9\-\.\_]+$/.test(npm_package_name) &&
                /^[a-zA-Z0-9]/.test(npm_package_name) &&
                /[a-zA-Z0-9]$/.test(npm_package_name)
            );
        }
    } 

    function process_header(data) { 
        data.text = data.text.trim();
        return data;
    } 

    function process_description(data) { 
        return (
            data
        );
    } 

} 


function retrieve_categories(linear_info) { 

    let categories = [];
    let category_ancestors = [];
    let category_last;
    const ids = {};

    linear_info
    .forEach(info => {
        if( info.type === 'link' ) {
            assert(category_last, JSON.stringify(info, null, 2));
            category_ancestors.forEach(c => c.number_of_all_resources++);
            category_last.resources.push(info.data);
            category_last.last_line = info.data.last_line;
        }

        if( info.type === 'description' ) {
            assert(category_last);
            assert(category_last.header_description===null);
            category_last.header_description = info.data.text;
            category_last.last_line = info.data.last_line;
        }

        if( info.type === 'header' ) {
            const header_level = info.data.header_level;

            category_ancestors = category_ancestors.filter(c => c.header_level < header_level);

            const parent_category_id = category_ancestors.length === 0 ? null : category_ancestors.slice(-1)[0].id;
            assert(parent_category_id || parent_category_id===null);

            const id = generate_id(info, parent_category_id);
            assert(ids[id]===undefined, id);
            ids[id] = true;

            const category = {
                id,
                text: info.data.text,
                parent_category_id,
                header_level,
                header_description: null,
                resources: [],
                number_of_all_resources: 0,
                last_line: info.data.last_line,
            };

            category_last = category;
            category_ancestors.push(category_last);
            categories.push(category);
            assert(category_ancestors.every((c, i) => i===0 || c.header_level > category_ancestors[i-1].header_level));
        }
    });

    categories = prune_empty_categories(categories);

    return categories;

    function prune_empty_categories(categories) { 

        categories = remove_empty(categories);
        categories = remove_useless_root(categories);

        return categories;

        function remove_empty(categories) {
            return categories.filter(c => c.number_of_all_resources>0);
        }

        function remove_useless_root(categories) {
            const root_categories = categories.filter(c => c.parent_category_id===null);
            assert(root_categories.length>0);
            if( root_categories.length!==1 ) {
                return categories;
            }
            const root_category = root_categories[0];
            assert(root_category.id);
            if( root_category.resources.length === 0 ) {
                categories = remove_root(categories);
            }
            return categories;

            function remove_root(categories) {
                categories = categories.filter(c => c.id !== root_category.id);
                categories.forEach(c => {
                    if( c.parent_category_id === root_category.id ) {
                        c.parent_category_id = null;
                    }
                });
                return categories;
            }
        }

    } 

    function generate_id(info, parent_category_id) { 
        const clashes = (() => { 
            const clashes = {};
            const slugs = {};
            linear_info.filter(i => i.type==='header').forEach(i => {
                const slug = slugify(i.data.text);
                if( slugs[slug] ) {
                    clashes[slug] = true;
                }
                slugs[slug] = true;
            });
            return clashes;
        })(); 

        let id = slugify(info.data.text);
        if( clashes[id] && parent_category_id !== null ) {
            id = parent_category_id + '_' + id;
        }
        return id;

        function slugify(str) {
            const slug = str.toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'-');
            assert(slug.split('-').every(p => p.length>0), slug);
            return slug;
        }
    } 
} 


function parse_markdown(text) { 
    if( !text || text.constructor !== String ) {
        throw new Error('input should be a `String`');
    }
    const ast = require('remark')().parse(text);

    log(JSON.stringify(ast, null, 2));

    assert(ast.children.constructor === Array);

    const linear_info =
        get_block_nodes(ast).map(block_node => {

            const header = parse_header(block_node);
            if( header !== null ) {
                return {
                    type: 'header',
                    data: header,
                };
            }

            const link = parse_link(block_node);
            if( link !== null ) {
                return {
                    type: 'link',
                    data: link,
                };
            }

            const description = parse_description(block_node);
            if( description !== null ) {
                return {
                    type: 'description',
                    data: description,
                };
            }

            return null;
        })
        .filter(d => d!==null);

    linear_info.forEach(d => log(d.type, d.data));

    return linear_info;

    function parse_header(node) { 
        let header = null;

        get_descendants(node, {include_root: true}).forEach(descendant => {
            if( descendant.type !== 'heading' ) {
                return;
            }

            assert(header===null);
            assert(descendant.depth.constructor===Number);
            header = {
                text: '',
                header_level: descendant.depth,
                last_line: null,
            };
            get_descendants(descendant).forEach(descendant_of_descendant => {
                if(descendant_of_descendant.type === 'text') {
                    const text = descendant_of_descendant.value;
                    assert(text.constructor === String);
                    header.text += text;
                    header.last_line = descendant_of_descendant.position.end.line;
                    assert(header.last_line.constructor === Number);
                }
            });
        });

        return header;
    } 

    function parse_link(node) { 
        let link = null;
        get_descendants(node, {include_root: true}).forEach(descendant => {
            if( descendant.type !== 'listItem' ) {
                return;
            }

            let texts = {
                before: '',
                inside: '',
                after: '',
            };
            let ast_depth_of_link;

            get_descendants(descendant).forEach(descendant_of_descendant => {
                if( descendant_of_descendant.type === 'link' ) {
                    // assert(link === null, JSON.stringify(link, null, 2) + '\n->\n'+ descendant_of_descendant.url);
                    link = {
                        texts,
                        url: descendant_of_descendant.url,
                        last_line: null,
                    };
                    assert(descendant_of_descendant.ast_depth.constructor===Number);
                    ast_depth_of_link = descendant_of_descendant.ast_depth;
                }
                if( descendant_of_descendant.type === 'text' ) {
                    const text = descendant_of_descendant.value;
                    assert(text.constructor===String);
                    if( link === null ) {
                        texts.before += text;
                    } else {
                        link.last_line = descendant_of_descendant.position.end.line;
                        assert(link.last_line.constructor === Number);
                        if( descendant_of_descendant.ast_depth > ast_depth_of_link && texts.after==='' ) {
                            texts.inside += text;
                        } else {
                            texts.after += text;
                        }
                    }
                }
            });


        });
        return link;
    } 

    function parse_description(node) { 
        let description = null;
        get_descendants(node, {include_root: true}).forEach(descendant => {
            if( descendant.type !== "emphasis" ) {
                return;
            }
            description = {
                text: '',
                last_line: null,
            };
            get_descendants(descendant).forEach(descendant_of_descendant => {
                if(descendant_of_descendant.type === 'text') {
                    const text = descendant_of_descendant.value;
                    assert(text.constructor === String);
                    description.text += text;
                    description.last_line = descendant_of_descendant.position.end.line;
                    assert(description.last_line.constructor === Number);
                }
            });
        });
        return description;
    } 

    function get_descendants(node, {ast_depth = 0, include_root}={}) { 
        node.ast_depth = ast_depth;
        ast_depth++;
        return (
            include_root ? [node] : []
        ).concat(
            (node.children||[])
            .map(child => get_descendants(child, {ast_depth, include_root: true}))
            .reduce((prev, curr) => prev.concat(curr),[])
        );
    } 

    function get_block_nodes(root_node) { 
        let block_nodes = [];
        root_node.children.forEach(node => {
            if( node.type === 'list' ) {
                block_nodes = block_nodes.concat(node.children);
            } else {
                block_nodes.push(node);
            }
        });
        return block_nodes;
    } 

} 


function log() { 
    if( ! options.debug ) {
        return
    }
    console.log.apply(console, arguments);
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
        .then(contens => {
            const categories = parse_markdown_catalog(contens, {style: 'npm_catalog'});
         // categories.forEach(c => {c.resources = c.resources.length});
            console.log(JSON.stringify(categories, null, 2));
        });
    }
} 

