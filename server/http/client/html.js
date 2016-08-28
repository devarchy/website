const cheerio = require('cheerio');
const ReactDomServer = require('react-dom/server');
const Promise = require('bluebird'); Promise.longStackTraces();
const readFile = Promise.promisify(require("fs").readFile);
const timerlog = require('timerlog');

const CLIENT_SRC = require('path').join(__dirname, '../../../client/src/');
const CLIENT_DIST = require('path').join(__dirname, '../../../client/dist/');


timerlog({ 
    id: "babel_load",
    start_timer: true,
    tag: "react_server_side",
    message: "Babel loaded",
}); 
require("babel-register")({
    "babelrc": false,
    "presets": ["node6", "react"],
    "plugins": [
      "babel-plugin-transform-decorators-legacy",
    ],
});
require("babel-polyfill");
timerlog({ 
    id: "babel_load",
    end_timer: true,
}); 

timerlog({ 
    id: "babel_compile",
    start_timer: true,
    tag: "react_server_side",
    message: "Babel compiled client side code",
}); 
const page = require(CLIENT_SRC+'js/page.js').default;
timerlog({ 
    id: "babel_compile",
    end_timer: true,
}); 


module.exports = pathname => {
    const log_id__overall = timerlog({ 
        start_timer: true,
        message: "HTML computed for "+pathname,
        tag: "react_server_side",
    }); 

    return (
        Promise.all(
            [get_index_manipulator()]
            .concat(
                page
                .filter(page_section => page_section.server_side_render)
                .map(page_section =>
                    page_section
                    .fetch(pathname)
                    .then(() => {
                        timerlog({ 
                            id: 'compute_element',
                            start_timer: true,
                            tag: "react_server_side",
                            message: "React element computed for `#"+page_section.node_id+"` for `"+pathname+"`",
                        }); 
                        const element = page_section.element(pathname);
                        timerlog({ 
                            id: 'compute_element',
                            end_timer: true,
                        }); 
                        timerlog({ 
                            id: 'render_element',
                            start_timer: true,
                            tag: "react_server_side",
                            message: "React element rendered to static markup for `#"+page_section.node_id+"` for `"+pathname+"`",
                        }); 
                        const section_html = ReactDomServer.renderToStaticMarkup(element);
                        timerlog({ 
                            id: 'render_element',
                            end_timer: true,
                        }); 
                        return {
                            section_html,
                            node_id: page_section.node_id,
                            page_head: page_section.get_page_head(pathname),
                        };
                    })
                )
            )
        )
        .then(([$, ...sections]) => {
            sections.forEach(({node_id, section_html, page_head}) => {
                $('#'+node_id).html(section_html);
                if( page_head ) {
                    if( page_head.title ) {
                        $('head > title').html(page_head.title);
                    }
                    if( page_head.description ) {
                        $('meta[name="description"]').attr('content', page_head.description);
                    }
                }
            });

            timerlog({ 
                id: log_id__overall,
                end_timer: true,
            }); 

            return $.html();
        })
    );
};


function get_index_manipulator() {
    const promise = readFile(CLIENT_DIST+"index.html", "utf8");

    get_index_manipulator = parse_html;
    return parse_html();

    function parse_html(){
        return promise.then(index_html => cheerio.load(index_html));
    }
}
