const fetch = require('./fetch_with_cache');
const assert = require('assert');
const cheerio = require('cheerio');
const chalk = require('chalk');


module.exports = {
    get_info,
    get_meta_data,
    get_age_by_wayback_machine,
};


const IGNORE = { 
    script: true,
    style: true,
    div: true,
    link: {
        rel: [
            'stylesheet',
            'alternate',
            'chrome-webstore-item',
            'dns-prefetch',
            'preconnect',
            'prefetch',
            'apple-touch-startup-image',
        ],
    },
    meta: {
        itemprop: ['applicationCategory'],
        property: [
            'og:type',
            'og:locale',
            'og:determiner',
            'og:image:height',
            'og:image:width',
            'fb:app_id',
            'fb:admins',
            'al:ios:url',
            'al:ios:app_store_id',
            'al:ios:app_name',
            'al:android:url',
            'al:android:app_name',
            'al:android:package',
        ],
        charset: true,
        'http-equiv': true,
        name: [
            'http-equiv',
            'viewport',
            'keywords',
            'referrer',
            'format-detection',
            'render-optimize-policy',
            'robots',
            'copyright',
            'content-language',
            'author',
            'msvalidate.01',
            'apple-itunes-app',
            'apple-mobile-web-app-capable',
            'apple-mobile-web-app-status-bar-style',
            'theme-color',
            'mobile-web-app-capable',
            'csrf-param',
            'csrf-token',
            'fb-app-id',
            'google',
            'google-site-verification',
            'google-play-app',
            'norton-safeweb-site-verification',
            'twitter:app:id:iphone',
            'twitter:app:id:ipad',
            'twitter:app:id:googleplay',
            'twitter:app:name:iphone',
            'twitter:app:name:ipad',
            'twitter:app:name:googleplay',
            'twitter:app:url:iphone',
            'twitter:app:url:ipad',
            'twitter:app:url:googleplay',
            'twitter:card',
            'twitter:creator',
            'twitter:create:id',
            'twitter:image:alt',
            'twitter:player',
            'twitter:site:id',
            'twitter:creator:id',
        ]
    },
}; 

const EXPECTED = (() => { 
    const EXPECTED_OG = [
        'og:description',
        'og:site_name', // name without description
        'og:title',
        'og:url',
        'og:image',
    ];
    const EXPECTED_TWITTER = [
        'twitter:title',
        'twitter:description',
        'twitter:image',
        'twitter:image:src',
        'twitter:site', // twitter @username
        'twitter:url', // Website URL
    ];
    return {
        title: true,
        meta: {
            itemprop: [
                'datePublished',
                'image',
                'name',
                'description',
            ],
            name: [
                'description',
                'msapplication-TileImage', // logo
            ].concat(
                EXPECTED_OG
            ).concat(
                EXPECTED_TWITTER
            ),
            property: [
                'fb:profile_id',
            ].concat(
                EXPECTED_OG
            ).concat(
                EXPECTED_TWITTER
            ),
        },
        link: {
            rel: [
                'manifest', // web manifest
                'shortcut icon',
                'apple-touch-icon',
                'icon',
                'image_src',
                'canonical', // Website URL
                'publisher', // Google Plus
                'search', // title
            ],
        },
    };
})(); 

function get_meta_data({url, max_delay}) { 

    return fetch({
        url,
        expected_error_status_codes: [404],
        timeout: max_delay,
        turn_https_to_http: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64 8530.96.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.154 Safari/537.36',
            'Accept-Language': 'en-US, en, es;q=0.01', // `es;q=0.01` because https://hangouts.google.com seem to require a non-english language in order to return english
        },
    })
    .then(resp => {
        if( !resp || resp.response_status_code===404 ) {
            return null;
        }
        assert((resp.response_body||0).constructor===String);
        const $ = cheerio.load(resp.response_body);

        const data = {};

        const heads = $('head');
        if( heads.length !==1 ) {
            log().unexpected(url, 'number of <head/> tags: '+heads.length);
        }

        if( heads[0] ) {
            heads[0]
            .children
            .map(html_tag => ( 
                {
                    html: $(html_tag).html(),
                    name: html_tag.name,
                    attribs: (() => {
                        const attribs = {};
                        for(var [key, val] of Object.entries(Object.assign({}, html_tag.attribs))) {
                            attribs[key.toLowerCase()] = val;
                        }
                        return attribs;
                    })(),
                }
            )) 
            .filter(html_tag => !is_ignored(html_tag))
            .forEach(({name, attribs, html}) => {
                if( EXPECTED[name]===true ) {
                    data[name] = data[name] || [];
                    data[name].push({text: html});
                    return;
                }
                for(var [attr_name, attr_val] of Object.entries(attribs)) {
                    if( ((EXPECTED[name]||{})[attr_name]||[]).includes(attr_val) ) {
                        data[name] = data[name] || {};
                        data[name][attr_name] = data[name][attr_name] || {}
                        data[name][attr_name][attr_val] = data[name][attr_name][attr_val] || [];
                        data[name][attr_name][attr_val].push(attribs);
                        return;
                    }
                }
                log().unexpected(url, 'html tag: '+JSON.stringify({name, attribs}));
            });
        }

        log().data(url, data);

        return data;
    });

    assert(false);

    function is_ignored({name, attribs}) { 
        if( ! name ) {
            return true;
        }
        if( IGNORE[name] === true ) {
            return true;
        }
        for(var [tag_name, attrs] of Object.entries(IGNORE)) {
            if( tag_name !== name ) {
                continue;
            }
            for(var [attr_name, attr_val] of Object.entries(attribs)) {
                if( attrs[attr_name]===true || (attrs[attr_name]||[]).includes(attr_val) ) {
                    log().ignore(url, attr_val);
                    return true;
                }
            }
        }
        return false;
    } 

} 

function get_info({url, max_delay}) { 
    let info = {
        html_title: null,
        html_description: null,
        html_published_at: null,
        html_created_at: null,
    };
    return Promise.all([
        get_meta_data({url, max_delay})
        .then(data => {
            if( data===null ) {
                info = null;
                return;
            }
            info.html_published_at =
                get('meta.itemprop.datePublished', d => only_if_date(d.content));

            info.html_self_url =
                get('link.rel.canonical', d => only_if_url(d.href)) ||
                get('meta.property.twitter:url', d => only_if_url(d.content)) ||
                get('meta.name.twitter:url', d => only_if_url(d.content)) ||
                get('meta.property.og:url', d => only_if_url(d.content)) ||
                get('meta.name.og:url', d => only_if_url(d.content));

            info.html_title =
                get('meta.property.og:site_name', d => only_if_title(d.content) ) ||
                get('meta.name.og:site_name', d => only_if_title(d.content) ) ||
                get('link.rel.search', d => only_if_title(d.title) ) ||
                get('meta.property.twitter:title', d => only_if_title(d.content) ) ||
                get('meta.name.twitter:title', d => only_if_title(d.content) ) ||
                get('title', d => only_if_title(d.text) ) ||
                get('meta.itemprop.name', d => only_if_title(d.content) ) ||
                get('meta.property.og:title', d => only_if_title(d.content) ) ||
                get('meta.name.og:title', d => only_if_title(d.content) );

            info.html_description =
                get('meta.property.og:description', d => d.content) ||
                get('meta.name.og:description', d => d.content) ||
                get('meta.property.twitter:description', d => d.content) ||
                get('meta.name.twitter:description', d => d.content) ||
                get('meta.name.description', d => d.content) ||
                get('meta.itemprop.description', d => d.content);

            log().missing(url, data, info);

            function only_if_date(date_str) { 
                const date = new Date(date_str);
                if( date != 'Invalid Date' ) {
                    return date;
                }
            } 

            function only_if_title(title) { 
                if( ! title ) {
                    return null;
                }
                if( title.split(' ').length>3 ) {
                    return null;
                }
                if( ! /^[a-zA-Z0-9\s\-]+$/.test(title) ) {
                    return null;
                }
                return title;
            } 

            function only_if_url(url) { 
                if( url && url.startsWith('http') ) {
                    return url;
                }
                return null;
            } 

            function get(path, transformer) { 
                let obj = data;
                let is_expected = EXPECTED;
                path
                .split('.')
                .forEach(dir => {
                    obj=(obj[dir]||{});
                    assert(is_expected[dir] || is_expected.constructor===Array && is_expected.includes(dir));
                    is_expected = is_expected[dir];
                });
                obj = obj[0];
                if( ! obj ) {
                    return null;
                }
                if( transformer ) {
                    obj = transformer(obj);
                }
                return obj;
            } 
        })
        ,
        get_age_by_wayback_machine({url, max_delay})
        .then(date => {
            if( date===null ) {
                return;
            }
            if( info===null ) {
                return;
            }
            assert(date.constructor===Date);
            info.html_created_at = date;
        })
        ,
    ])
    .then(() => {
        log().result(url, info);
        return info;
    });
} 

function get_age_by_wayback_machine({url, max_delay}) { 
    url = 'http://archive.org/wayback/available?url='+url+'/&timestamp=197000101';
    return fetch({
        url,
        timeout: max_delay,
        json: true,
        pushy: true,
    })
    .then(resp => {
        assert(resp);
        assert(resp.response_body);
        const snapshots = resp.response_body.archived_snapshots;
        if( ! snapshots ) {
            return null;
        }
        const timestamp = (snapshots.closest||{}).timestamp;
        if( ! timestamp ) {
            return null;
        }
        const year = parseInt(timestamp.slice(0,4),10);
        const month = parseInt(timestamp.slice(4,6),10);
        const day = parseInt(timestamp.slice(6,8),10);
        return new Date(year, month, day);
    });
} 

function log() { 
    const _log = {
        unexpected,
        ignore,
        data,
        missing,
        result,
    };

    const LOGGING_STATES = [
        'NONE',
        'ALL',
        'MISSING',
        'RESULT',
    ];

    const LOGGING = LOGGING_STATES[0];

    log = () => _log;
    return log();

    function unexpected(url, msg) {
        if( LOGGING!==LOGGING_STATES[1] ) { return; }
        console.log(chalk.yellow('[U'+'NEXPECTED]['+url+'] '+msg));
    }
    function ignore(url, attr_val) {
        if( LOGGING!==LOGGING_STATES[1] ) { return; }
        if( !LOGGING ) { return; }
        console.log(chalk.cyan('[IGNORED]['+url+'] '+JSON.stringify(attr_val)));
    }
    function data(url, data) {
        if( LOGGING!==LOGGING_STATES[1] ) { return; }
        console.log(chalk.blue(url+'\n'+JSON.stringify(data, null, 2)));
    }
    function missing(url, data, info) {
        if( LOGGING!==LOGGING_STATES[2] ) { return; }
        if( (info||0).constructor === Object && info.html_title && info.html_description ) {
            return;
        }
        print_info(url, info);
        print_data(data);
    }
    function result(url, info) {
        if( LOGGING!==LOGGING_STATES[3] ) { return; }
        print_info(url, info);
    }
    function print_info(url, info) {
        console.log(chalk.blue([
            url,
            JSON.stringify(info, null, 2),
        ].join('\n')));
    }
    function print_data(data) {
        console.log(chalk.magenta([
            JSON.stringify(data, null, 2),
        ].join('\n')));
    }
} 
