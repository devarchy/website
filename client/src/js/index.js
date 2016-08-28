import 'font-awesome/css/font-awesome.min.css';
import 'octicons/build/font/octicons.min.css';
import 'github-markdown-css/github-markdown.css';
import 'babel-polyfill';
import Promise from 'bluebird';
import React from 'react';
import ReactDOM from 'react-dom';
import timerlog from 'timerlog';
/*
import ReactDOMServer from 'react-dom/server';
//*/
import LoadingSnippet from './components/snippets/loading';
import navigation from './navigation.js';
import assert from 'assert';
import Thing from './thing';
import page from './page';
import rerender from './rerender';
Promise.longStackTraces();


/*
import Perf from 'react-addons-perf';
Perf.start()
setTimeout(() => {
    Perf.stop();
    Perf.printInclusive();
    Perf.printWasted();
    // Perf.printOperations();
}, 6000);
//*/


assert(
    typeof window !== 'undefined',
    [
        'This module coordinates website mutations',
        'It is meant to be run in the browser',
        'It is the entry point for the browser',
    ].join('. '));


window.Thing = Thing;


navigation.on_change = () => {
    make.tag_list.render();
    make.content.fetch_and_render();
};

const make = create_make();

{
    let initial_view_rendered = false;
    make.content.fetch_and_render()
    .then(() => {
        initial_view_rendered = true;
    });

    rerender.action = () => {
        assert(initial_view_rendered);
        timerlog({tag:'dataflow', message: 're-render all'});
        make.content.render();
    };
}

make.userinfo.fetch_and_render();
make.tag_list.fetch_and_render();


export default null;


function create_make() { 
    const make = {};

    page.forEach(page_section => {
        make[page_section.name] = {
            node: document.getElementById(page_section.node_id),
            render: function() {
                const navigation_current = navigation.current;
                assert(navigation_current.constructor===String);
                const page_head = page_section.get_page_head(navigation_current);
                if( (page_head||{}).title ) {
                    document.title = page_head.title;
                }
                timerlog({tag:'dataflow', message: 'Render '+page_section.node_id});
                const log_id__element = timerlog({message: 'Create React Element for `#'+page_section.node_id+'`', start_timer: true, tag: 'performance', measured_time_threshold: 5});
             // console.profile("Create React Element for "+page_section.node_id);
                const element = page_section.element(navigation_current);
             // console.profileEnd();
                timerlog({id: log_id__element, end_timer: true});
                const log_id__render = timerlog({message: '`ReactDOM.render()` for `#'+page_section.node_id+'`', start_timer: true, tag: 'performance', measured_time_threshold: 50});
                //*/
             // console.profile("Render React Element for "+page_section.node_id);
                //*
                ReactDOM.render(
                    element,
                    this.node,
                    () => {
                        timerlog({id: log_id__render, end_timer: true});
                     // console.profileEnd();
                    }
                );
                //*/
                /*/
                ReactDOMServer.renderToStaticMarkup(element);
                timerlog({id: log_id__render, end_timer: true});
                //*/
            },
            fetch_and_render: function() {
                return (() => {
                    const dont_erase_prerendered = (() => {
                        const server_has_rendered = this.node.innerHTML !=='';
                        return navigation.user_has_not_navigated_yet && server_has_rendered;
                    })();

                    const fetch_promise = page_section.fetch(navigation.current);

                    if( ! dont_erase_prerendered ) {
                        if( page_section.also_show_when_fetching(navigation.current) ) {
                            this.render();
                        }
                        else {
                            ReactDOM.render(
                                React.createElement(LoadingSnippet.component, {style: {paddingTop: 50}}),
                                this.node
                            );
                        }
                    }

                    return fetch_promise;
                })()
                .then(() => {
                    this.render();
                });
            },
        }
    });

    return make;

} 
