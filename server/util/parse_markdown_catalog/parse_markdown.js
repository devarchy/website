const assert = require('assertion-soft/hard');
const log = require('./util/log');
const cheerio = require('cheerio');

// parsers providing location information:
// - https://github.com/wooorm/remark
// - https://github.com/jgm/commonmark.js
// - https://github.com/textlint/markdown-to-ast
const remark = require('remark');


module.exports = function parse_markdown(markdown_text) {
    if( !markdown_text || markdown_text.constructor !== String ) {
        throw new Error('input should be a `String`');
    }
    const ast = remark().parse(markdown_text);

    log(JSON.stringify(ast, null, 2));

    assert(ast.children.constructor === Array);

    let previous_info = null;

    let linear_info = get_block_nodes(ast);

 // console.log(JSON.stringify(linear_info, null, 2));

    linear_info = assemble_em_pieces(linear_info);

 // console.log(JSON.stringify(linear_info, null, 2));

    linear_info = (
        linear_info
        .map(block_node => {

            const info = (() => {
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
                if( description !== null && (previous_info||{}).type==='header') {
                    return {
                        type: 'description',
                        raw_data: description,
                    };
                }

                return null;
            })();

            if( info ) {
                previous_info = info;
            }

            return info;
        })
        .filter(d => d!==null)
        .filter(({type, raw_data: {url}}) => type!=='link' || url.startsWith('http'))
    );

    linear_info.forEach(d => log(d.type, d.raw_data));

    return linear_info;

    function parse_header(node) { 
        let header = null;

        get_descendants(node, {include_root: true}).forEach(descendant => {
            if( descendant.type !== 'heading' ) {
                return;
            }

            assert(header===null, JSON.stringify(node, null, 2));
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

        if( ! (header||{}).text ) {
            return null;
        }

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
                //  assert(link === null, JSON.stringify(link, null, 2) + '\n->\n'+ descendant_of_descendant.url);
                    if( link !== null ) {
                        return;
                    }
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

    function assemble_em_pieces(nodes) {
        let em_current = null;

        const nodes_new = process_nodes(nodes);

        assert(em_current===null, em_current);

        return nodes_new;

        function process_nodes(nodes_) {
            const nodes_processed = [];

            nodes_
            .forEach(node => {
                const node_processed = process_node(node);
                assert(node_processed===null || node_processed);
                if( node_processed ) {
                    nodes_processed.push(node_processed);
                }
            })

            return nodes_processed;

            function process_node(node) {

                const node_text = node.value;
                const em_start = (node_text||'').startsWith('<em>');
                const em_end = (node_text||'').endsWith('</em>');

                if( em_current ) {
                    assert(!em_start, em_current, node);
                    if( node.type === 'paragraph' ) {
                        assert(!node_text);
                        em_current.position.end = node.position.end;
                        assert(node.children);
                        assert(node.children.length>0);
                        process_nodes(node.children)
                        .forEach(node => nodes_processed.push(node));
                        return null;
                    }
                    if( !em_end ) {
                        return null;
                    }
                    if( em_end ) {
                        em_current.position.end = em_current.position.end || node.position.end;
                        const new_node = em_current;
                        const text_value = (
                            markdown_text.slice(
                                new_node.position.start.offset,
                                new_node.position.end.offset
                            )
                        );
                        new_node.value = text_value;
                        em_current = null;
                        assert(new_node.value);
                        assert(new_node.position.start);
                        assert(new_node.position.end);
                        return new_node;
                    }
                } else {
                    if( node.type === 'paragraph' ) {
                        assert(!node_text);
                        assert(node.children);
                        assert(node.children.length>0);
                        process_nodes(node.children)
                        .forEach(node => nodes_processed.push(node));
                        return null;
                    }
                    if( node.type !== 'html' ) {
                        return node;
                    }
                    if( em_start === em_end ) {
                        return node;
                    }
                    assert(!em_end, em_current, node);
                    if( em_start ) {
                        assert(em_current === null);
                        em_current = {
                            type: 'html',
                            value: null,
                            position: {
                                start: node.position.start,
                            },
                        };
                        return null;
                    }
                }
                assert(false);
            }
        }
    }

    function parse_description(node) { 
        let description = null;
        get_descendants(node, {include_root: true})
        .forEach(descendant => {
            if( descendant.type === 'html' ) {
                const text = extract_description(descendant);

                if( text ) {
                    assert(description===null);
                    description = {
                        text,
                        last_line: descendant.position.end.line,
                    };
                }
                return;
            }
            if( descendant.type !== "emphasis" ) {
                return;
            }
            assert(description===null);
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

        function extract_description(descendant) {
            const html_str = descendant.value;

            let text = (() => {
                if( html_str.startsWith('<em>') && html_str.endsWith('</em>') ) {
                    return html_str.slice('<em>'.length, -1*'</em>'.length);
                }
                const $ = cheerio.load(html_str);
                const root_nodes = $.root().children();
                const root_node = root_nodes[0];
                if( root_node ) {
                    if( root_node.type==='tag' && root_node.name==='em' ) {
                        return $(root_node).text();
                    }
                }
            })();

            if( !text ) {
                return text;
            }

            if( text.startsWith('\n') ) {
                text = text.slice(1);
            }
            if( text.endsWith('\n') ) {
                text = text.slice(0, -1);
            }
            return text;
        }
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
