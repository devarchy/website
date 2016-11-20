const assert = require('assert');
const log = require('./util/log');

// parsers providing location information:
// - https://github.com/wooorm/remark
// - https://github.com/jgm/commonmark.js
// - https://github.com/textlint/markdown-to-ast
const remark = require('remark');


module.exports = function parse_markdown(text) {
    if( !text || text.constructor !== String ) {
        throw new Error('input should be a `String`');
    }
    const ast = remark().parse(text);

    log(JSON.stringify(ast, null, 2));

    assert(ast.children.constructor === Array);

    const linear_info =
        get_block_nodes(ast).map(block_node => {

            const header = parse_header(block_node);
            if( header !== null ) {
                return {
                    type: 'header',
                    raw_data: header,
                };
            }

            const link = parse_link(block_node);
            if( link !== null ) {
                return {
                    type: 'link',
                    raw_data: link,
                };
            }

            const description = parse_description(block_node);
            if( description !== null ) {
                return {
                    type: 'description',
                    raw_data: description,
                };
            }

            return null;
        })
        .filter(d => d!==null);

    linear_info.forEach(d => log(d.type, d.raw_data));

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
                if( ['text', 'inlineCode'].includes(descendant_of_descendant.type) ) {
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

};
