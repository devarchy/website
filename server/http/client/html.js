const ReactDomServer = require('react-dom/server');
const Promise = require('bluebird'); Promise.longStackTraces();
const Promise_serial = require('promise-serial');
const readFile = Promise.promisify(require("fs").readFile);
const timerlog = require('timerlog');
const assert_soft = require('assertion-soft');
const memoize = require('../../util/memoize');

const CLIENT_SRC = require('path').join(__dirname, '../../../client/src/');
const CLIENT_DIST = require('path').join(__dirname, '../../../client/dist/');


timerlog({ 
    disable: true,
    id: "babel_load",
    start_timer: true,
    tag: "babel",
}); 
require("babel-register")({
    "babelrc": false,
    "presets": ["node6", "stage-2", "es2016", "es2017", "react"],
    "plugins": [],
});
require("babel-polyfill");
timerlog({ 
    id: "babel_load",
    end_timer: true,
}); 

timerlog({ 
    id: "babel_compile",
    start_timer: true,
    tag: "babel",
}); 
const page = require(CLIENT_SRC+'js/page.js').default;
timerlog({ 
    disable: true,
    id: "babel_compile",
    end_timer: true,
}); 

module.exports = ({pathname, hostname, production_url}) => {
    assert_soft(hostname);
    assert_soft(pathname);

    const args = {
        pathname,
        hostname,
        is_fetching_data: false, // we lie on purpose
    };

    return (
        //*
        Promise.all([
            get_index_manipulator({pathname}),
            ...(
                page
                .sections
                .filter(page_section => page_section.section__server_side_render)
                .map(page_section =>
                    Promise.all([
                        page.overall.get_initial_fetch_promise(args),
                        page_section.section__fetch(args),
                    ])
                    .then(([_, section_fetch_output]) => ({section_fetch_output, page_section}))
                )
            )
        ])
        /*/ serial version, useful to measure performance
        Promise_serial([
            () => get_index_manipulator({pathname}),
            ...(
                page
                .sections
                .filter(page_section => page_section.section__server_side_render)
                .map(page_section => () => {
                    const log_id = 'section_'+page_section.section__name;
                    timerlog({
                        tags: ["performance", "overall"],
                        start_timer: true,
                        id: log_id,
                    });
                    let sd;
                    return (
                        Promise.resolve()
                        .then(() => {
                            sd = new Date();
                        })
                        .then(() =>
                            page.overall.get_initial_fetch_promise(args)
                        )
                        .then(() => {
                            console.log('t1: '+(new Date() - sd));
                        })
                        .then(() =>
                            page_section.section__fetch(args)
                        )
                        .then(section_fetch_output => {
                            console.log('t2: '+(new Date() - sd));
                            return ({section_fetch_output, page_section})
                        })
                        .then((section_fetch_output) => ({section_fetch_output, page_section}))
                        .then(ret => {
                            console.log('t3: '+(new Date() - sd));
                            timerlog({
                                id: log_id,
                                end_timer: true,
                            });
                            console.log('t4: '+(new Date() - sd));
                            return ret;
                        })
                    );
                })
            )
        ])
        //*/
        .then(([index_manipulator, ...sections]) => {

            timerlog({
                tags: ["performance", "processing"],
                start_timer: true,
                disable: true,
                id: 'get_sections_info',
            });

            sections = (
                sections
                .map(({section_fetch_output, page_section}) => ({
                    section_html: compute_html({page_section, args, section_fetch_output}),
                    node_selector: page_section.section__node_selector(args),
                    page_head: page_section.section__get_page_head(args),
                }))
            );

            timerlog({
                id: 'get_sections_info',
                end_timer: true,
            });

            timerlog({
                tags: ["performance", "processing"],
                start_timer: true,
                id: 'assemble_html',
            });

            index_manipulator.reset();

            const resp_obj = {
                html_str: null,
                return_status_code: null,
            };

            {
                let page_head = null;
                sections.forEach(({node_selector, section_html, page_head: page_head_}) => {
                    index_manipulator.set_html(node_selector, section_html);
                    if( page_head_ ) {
                        assert_soft(page_head===null);
                        page_head = page_head_;
                    }
                });
                if( assert_soft((page_head||1).constructor===Object, page_head) ) {
                    assert_soft(page_head.title, page_head, args.pathname);
                    assert_soft(page_head.description, page_head, args.pathname);
                    if( page_head.title ) {
                        index_manipulator.set_html('head > title', page_head.title);
                    }
                    if( page_head.description ) {
                        index_manipulator.set_attribute('meta[name="description"]', 'content', page_head.description);
                    }

                    {
                        const head_addendum = [];
                        if( page_head.dont_index ) {
                            head_addendum.push('<meta name="robots" content="noindex">');
                        }
                        {
                            const canonical_url = page_head.canonical_url || production_url;
                            if( canonical_url ) {
                                if( assert_soft(!canonical_url.includes('"')) ) {
                                    head_addendum.push('<link rel="canonical" href="'+canonical_url+'">');
                                }
                            }
                        }
                        if( head_addendum.length>0 ) {
                            index_manipulator.add_html_to_head(
                                head_addendum.join('')
                            );
                        }
                    }

                    if( page_head.return_status_code ) {
                        resp_obj.return_status_code = page_head.return_status_code;
                    }

                    if( page_head.redirect_to ) {
                        resp_obj.redirect_to = page_head.redirect_to;
                    }
                }
            }

            if( page.overall.is_sidebar_hidden(args.pathname) ) {
                index_manipulator.add_html_class('css_hide_sidebar');
            }

            resp_obj.html_str = index_manipulator.get_html();

            timerlog({
                id: 'assemble_html',
                end_timer: true,
            });

            return resp_obj;
        })
    );
};

function compute_html({page_section, section_fetch_output, args}) {

    if( ! section_fetch_output || ! section_fetch_output.content_is_single_data_source ) {
        return computation();
    }

    const things_matched__hash = section_fetch_output.plugin_memory_cache.things_matched__hash;
    assert_soft(things_matched__hash);
    if( !things_matched__hash ) {
        return computation();
    }

    return memoize({
        memory_cluster: 'server_render_cache',
        cache_key: [
            ...Object.values(args),
            page_section.section__name,
            things_matched__hash,
        ],
        computation,
        message_addendum: ' for '+args.pathname,
    }).content;

    function computation() {
        timerlog({ 
            id: 'compute_element',
            start_timer: true,
            tags: ["performance", "react_render"],
            message: "React element computed for `"+args.pathname+"`",
        }); 
        const element = page_section.section__element(args);
        timerlog({ 
            id: 'compute_element',
            end_timer: true,
        }); 
        timerlog({ 
            id: 'render_element',
            start_timer: true,
            tags: ["performance", "react_render"],
            message: "React element rendered to static markup for `"+args.pathname+"`",
        }); 
        const section_html = ReactDomServer.renderToStaticMarkup(element);
        timerlog({ 
            id: 'render_element',
            end_timer: true,
        }); 
        return section_html;
    }
}

function get_index_manipulator({pathname}) {
    const promise = (
        readFile(CLIENT_DIST+"index.html", "utf8")
     // .then(index_html => get_cheerio_manipulator(index_html))
     // .then(index_html => get_jsdom_manipulator(index_html))
     // .then(index_html => /* no fast dom manipulator based on parse5? https://github.com/inikulin/parse5/issues/42 */)
        .then(index_html => get_cheating_str_manipulator(index_html, {pathname}))
    );

    get_index_manipulator = () => promise;
    return promise;
}

function get_cheating_str_manipulator(index_html, {pathname}) {

    const SPLITTER = '<span id="replaceme"></span>';
    const PLACEHOLDER = 'devarchy__i_should_be_gone';

    const parts_source = [];
    index_html
    .split(SPLITTER)
    .forEach((part, i) => {
        if( i!==0 ) {
            parts_source.push(PLACEHOLDER);
        }
        parts_source.push(part);
    });
    assert_soft(parts_source.length===13, parts_source);

    let parts;

    return ({
        reset: () => {
            parts = parts_source.slice();
        },
        set_html: (selector, html) => {
            if( selector==='head > title' ) {
                parts[3] = html;
                return;
            }
            if( selector==='#js_logo_section_2' ) {
                parts[5] = html;
                return;
            }
            if( selector==='#js_logo_section_1' ) {
                parts[7] = html;
                return;
            }
            if( selector==='#js_tag_list' ) {
                parts[9] = html;
                return;
            }
            if( selector==='.sel_main_view_content' ) {
                parts[11] = html;
                return;
            }
            assert_soft(false, selector);
        },
        set_attribute: (selector, attr_name, str) => {
            if( selector==='meta[name="description"]' && attr_name==='content' ) {
                parts[1] = str;
                return;
            }
            assert_soft(false, selector, attr_name);
        },
        get_html: () => {
            const html_str = parts.join('');
            assert_soft(html_str, html_str);
            {
                const i = html_str.indexOf(SPLITTER);
                if( i!== -1 ) {
                    assert_soft(
                        !html_str.includes(SPLITTER),
                        html_str.slice(Math.max(i-300, 0), i+300),
                        pathname
                    );
                }
            }
            {
                const i = html_str.indexOf(PLACEHOLDER);
                if( i!== -1 ) {
                    assert_soft(
                        !html_str.includes(PLACEHOLDER),
                        html_str.slice(Math.max(i-300, 0), i+300),
                        pathname
                    );
                }
            }
            return html_str;
        },
        add_html_class: class_name => {
            const str='<html class="';
            assert_soft(parts[0].includes(str));
            parts[0] = parts[0].replace(str, str+class_name+' ');
        },
        add_html_to_head: html_str => {
            const str='</head>';
            assert_soft(parts[4].includes(str));
            parts[4] = parts[4].replace(str, html_str+str);
        },
    });
}

/*
function get_cheerio_manipulator(index_html) {
     const cheerio = require('cheerio');
     const $ = cheerio.load(index_html);

     return ({
        set_html: (selector, html) => { $(selector).html(html); },
        set_attribute: (selector, attr_name, str) => { $(selector).attr(attr_name, str); },
        get_html: () => $.html(),
     });
}

function get_jsdom_manipulator(index_html) {
    const jsdom = require('jsdom');

    const document = jsdom.jsdom(index_html);

    return {
        set_html: (selector, html) => { document.querySelector(selector).innerHTML = html; },
        set_attribute: (selector, attr_name, str) => { document.querySelector(selector).setAttribute(attr_name, str); },
        get_html: () => document.documentElement.outerHTML,
    };
}
*/

