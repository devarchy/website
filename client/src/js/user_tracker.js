import timerlog from 'timerlog';
import assert_soft from 'assertion-soft';
import debouncer from './util/debouncer';
import router from './router';


const user_tracker = {
    install: {
        setup,
        load_script,
    },
    log_event,
    log_pageview,
    log_pageroute,
    set_user_id,
    trackers: {
        track_page_search,
        track_page_scroll,
        track_visit_count,
        track_resource_view,
        track_bouncing,
        track_logo_hover,
        track_search,
    },
};

export default user_tracker;

const visit_start = new Date();
let clientId='NA';

let isnt_bounce;
function log_event({category, action, value, additional_info, only_if_debouncing, not_an_action, event_value}) { 
    assert_soft(value===undefined);
    assert_soft(category);
    assert_soft((category||0).constructor===String);
    assert_soft(action);
    assert_soft([String, Array].constructor((action||0).constructor));
    assert_soft(additional_info===undefined || additional_info.constructor===Object);
    assert_soft(pageview_sent===true, arguments, category);

    if( !is_installed() ) {
        return;
    }

    if( only_if_debouncing && isnt_bounce ) {
        return;
    }

    category = category || 'NA';
    action = action || 'NA';

    const info = {};
    info.category = category;
    info.action = action;

    info.page_path = window.location.pathname;

    info.page_route = router.get_pattern(info.page_path) || 'NA';

    info.user_origin = document.referrer || 'null';
    info.user_name = (Thing.things.logged_user||{}).user_provider_and_name || 'anonymous';
    info.user_clientId = clientId;
    info.user_visits_number = da_visits.length;
    info.user_visits = da_visits.map(d => {
        if( !d || d.constructor !== Date ) {
            assert_soft(false, da_visits);
            return;
        }
        return d.toDateString().split(' ').slice(1).join(' ');
    })
    .join(',');

    info.when = printify_date(new Date());
    {
        let delta = (new Date() - visit_start)/1000;
        if( delta > 180*60 ) {
            delta = Math.floor(delta/(60*60))+'h';
        }
        else if( delta > 180 ) {
            delta = Math.floor(delta/60)+'m';
        } else {
            delta = delta+'s'
        }
        info.when_offset = delta;
    }

    info.visit_start = printify_date(visit_start);

    additional_info = additional_info || {};
    assert_soft(!additional_info.category);
    assert_soft(!additional_info.action);
    assert_soft(!additional_info.page_path);
    assert_soft(!additional_info.after_init);
    assert_soft(!additional_info.user_origin);
    assert_soft(!additional_info.username);
    Object.assign(info, additional_info);

    const serialize_info = keys => (
        Object.entries(info)
        .filter(([key]) => !keys || keys.includes && keys.includes(key))
        .map(([key, val]) => key+':'+val)
        .map(s => '['+s+']')
        .join(' ')
    );

    const label = serialize_info();

    if( (action||0).constructor === Array ) {
        action = serialize_info(action);
    }

    // Field Name      Value Type  Required    Description
    // eventCategory   text        yes         Typically the object that was interacted with (e.g. 'Video')
    // eventAction     text        yes         The type of interaction (e.g. 'play')
    // eventLabel      text        no          Useful for categorizing events (e.g. 'Fall Campaign')
    // eventValue      integer     no          A numeric value associated with the event (e.g. 42)
    // ga('send', 'event', [eventCategory], [eventAction], [eventLabel], [eventValue], [fieldsObject]);
    // https://developers.google.com/analytics/devguides/collection/analyticsjs/events
    const event_info = {
        hitType: 'event',
        eventCategory: category,
        eventAction: action,
        eventLabel: label,
    };
    if( not_an_action ) {
        event_info.nonInteraction = true;
    }
    if( event_value ) {
        event_info.eventValue = event_value;
    }
    window.ga('send', event_info);

    if( ! not_an_action ) {
        isnt_bounce = true;
    }

    const message = (
        'logged: '+
        JSON.stringify(event_info)
    );
    timerlog({tags: ['dataflow', 'analytics', 'event'], message});

    return;

    function printify_date(d) {
        const time = d.toISOString().split('.')[0];
        let timezone_offset = (new Date().getTimezoneOffset()*-1/60);
        if( timezone_offset > 0 ) {
            timezone_offset = '+'+timezone_offset;
        }
        return time+'_'+timezone_offset;
    }
} 

let pageview_sent;
function log_pageview(pathname) { 
    if( ! assert_soft(is_installed()) ) {
        return;
    }
    if( ! assert_soft(!pageview_sent) ) {
        return;
    }
    assert_soft(pathname);
    assert_soft((pathname||'').startsWith('/'));
    assert_soft(window.location.hostname==='localhost' || pathname===window.location.pathname);
    window.ga('send', 'pageview', pathname);
    pageview_sent = true;
    timerlog({tags: ['dataflow', 'analytics', 'pageview'], message: pathname});
    user_tracker.log_event({category: 'pageview', action: ['page_path'], not_an_action: true});
} 

function log_pageroute() { 
    user_tracker.log_event({category: 'pageroute', action: ['page_route'], not_an_action: true});
} 

function setup() { 
    setup_queue();

    const TRACK_ID = 'UA-5263303-18';
    const DISABLED = is_disabled();

    if( DISABLED ) {
        window['ga-disable-'+TRACK_ID] = true;
    }

    window.ga('create', TRACK_ID, 'auto');

    window.ga(function(tracker) {
        clientId = tracker.get('clientId');
    });

    save_visit();

    timerlog({tags: ['dataflow', 'analytics', 'install'], message: 'setup done'+(DISABLED?' [tracking_disabled]':'')});
} 

function setup_queue() { 
    // https://developers.google.com/analytics/devguides/collection/analyticsjs/#alternative_async_tracking_snippet
    window.ga=window.ga||function(){(ga.q=ga.q||[]).push(arguments)};ga.l=+new Date;
} 
function load_script() { 
    // https://developers.google.com/analytics/devguides/collection/analyticsjs/#alternative_async_tracking_snippet
    /*
        Unwinding of

        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
            (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
            m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

        =>

        window['GoogleAnalyticsObject']='ga';
        window['ga']=window['ga']||function(){(window['ga'].q=window['ga'].q||[]).push(arguments)},window['ga'].l=1*new Date();
        var a=document.createElement('script'),
        var m=document.getElementsByTagName('script')[0];
        a.async=1;
        a.src='https://www.google-analytics.com/analytics.js';
        m.parentNode.insertBefore(a,m)
    */
    var a=document.createElement('script');
    var m=document.getElementsByTagName('script')[0];
    a.async=1;
    a.src='https://www.google-analytics.com/analytics.js';
    a.onload = () => {
        timerlog({tags: ['dataflow', 'analytics', 'install'], message: 'script loaded'});
    };
    m.parentNode.insertBefore(a,m);
} 

function is_disabled() { 
    if( window.location.hostname==='localhost' ) {
        return true;
    }
    if( window.localStorage && window.localStorage['tracking_disabled'] ) {
        return true;
    }
    /*
    if( ! window.localStorage ) {
        return true;
    }
    */
    return false;
} 

function set_user_id(USER_ID) { 
    if( ! is_installed() ) {
        return;
    }
    window.ga('set', 'userId', USER_ID);
    timerlog({tags: ['dataflow', 'analytics', 'install'], message: 'associated with user `'+USER_ID+'`'});
} 

function is_installed() { 
    if( typeof window === 'undefined' ) {
        return false;
    }
    if( ! window.ga ) {
        return false;
    }
    return true;
} 

function track_page_search() { 
    let last_keydown = null;
    window.addEventListener('keydown', ev => {
        if ( ( ev.keyCode == 70 && ( ev.ctrlKey || ev.metaKey ) ) ||
             ( ev.keyCode == 191 ) ) {
            last_keydown = new Date().getTime();
        }
    }, {passive: true});
    window.addEventListener('blur', (ev) => {
        if ( last_keydown !== null ) {
            var delta = new Date().getTime() - last_keydown;
            if ( delta >= 0 && delta < 1000 ) {
                user_tracker.log_event({category: 'page search', action: ['page_path']});
            }
            last_keydown = null;
        }
    }, {passive: true});
} 

let has_scrolled;
function track_page_scroll() { 
    let already_fired;
    let timeout;
    window.addEventListener('scroll', () => {
        if( already_fired ) { return; }
        if( timeout ) { return; }
        has_scrolled = true;
        timeout = setTimeout(() => {
            timeout = null;
            if( already_fired ) { return; }
            if( document.body.scrollTop > 1600 ) {
                user_tracker.log_event({category: 'page scroll', action: ['page_path'], only_if_debouncing: true});
                already_fired = true;
            }
        }, 300);
    }, {passive: true});
} 

let da_visits;
function save_visit() { 
    if( ! is_installed() ) { return; }
    if( ! window.localStorage ) {
        assert_soft(false);
        return;
    };

    const ls_key = '__da_v';
    try {
        da_visits = JSON.parse(window.localStorage[ls_key]||"null");
    } catch(e) {
        assert_soft(false, e);
    }

    if( ! da_visits || da_visits && da_visits.constructor!==Array ) {
        assert_soft(da_visits===null || da_visits & da_visits.constructor===Array, da_visits, localStorage[ls_key]);
        da_visits = [];
    }

    da_visits = (
        da_visits.map(d => {
            if( d ) {
                d = new Date(d);
                if( ! isNaN(d.getTime()) ) {
                    return d;
                }
            }
            return null;
        })
        .filter(Boolean)
    );

    da_visits.push(visit_start);

    window.localStorage[ls_key] = JSON.stringify(da_visits);
} 

function track_visit_count() { 
    if( !da_visits || da_visits.constructor!==Array || !da_visits.length ) {
        assert_soft(false, da_visits);
        return;
    }
    const count = da_visits.length;
    user_tracker.log_event({category: 'visit', action: count, not_an_action: true, event_value: count});
} 

let has_viewed_a_resource;
function track_resource_view({viewed_in}={}) { 
    has_viewed_a_resource = true;
    if( ! is_installed() ) { return; }
    if( ! window.localStorage ) {
        assert_soft(false);
        return;
    };
    assert_soft(viewed_in);

    let count;
    const ls_key = '__da_rv';
    try {
        count = JSON.parse(window.localStorage[ls_key]||"null");
    } catch(e) {
        assert_soft(false, e);
    }

    if( !count || count.constructor!==Number  ) {
        assert_soft(count===null || count && count.constructor===Number, count, localStorage[ls_key]);
        count = 0;
    }

    count++;

    window.localStorage[ls_key] = JSON.stringify(count);

    user_tracker.log_event({
        category: 'view_resource',
        action: count,
        not_an_action: true,
        event_value: count,
        additional_info: {
            viewed_in,
        },
    });
} 

function track_bouncing() { 
    window.addEventListener('beforeunload', () => {
        if( has_viewed_a_resource ) {
            return;
        }
        let action = '_';
        if( has_scrolled ) {
            action += '[with_scroll]';
        }
        if( isnt_bounce ) {
            action += '[with_action]';
        }
        const event_value = new Date() - visit_start;
        user_tracker.log_event({
            category: 'exit_without_resource_view',
            action,
            event_value,
            not_an_action: true,
        });
    });
} 

let hovered_already;
let hover_timeout;
function track_logo_hover({on_mouse_leave, on_mouse_enter}={}) { 
    if( ! assert_soft(on_mouse_enter || on_mouse_leave) ) return;

    if( hovered_already ) {
        return;
    }

    clearTimeout(hover_timeout);

    if( on_mouse_leave ) {
        return;
    }

    if( on_mouse_enter ) {
        hover_timeout = setTimeout(() => {
            if( !assert_soft(!hovered_already) ) return;
            hovered_already = true;
            send_track_event();
        }, 1000);
    }

    return;

    function send_track_event() {
        user_tracker.log_event({
            category: 'logo_hover',
            action: ['page_route'],
            not_an_action: true,
        });
    }
} 

const search_track__all = debouncer(search_query => { 
    assert_soft(search_query);

    user_tracker.log_event({
        category: 'search_run',
        action: search_query,
    });
}, {time: 2000}); 
let search_track__used;
function track_search(search_query) { 
    if( ! search_query ) {
        return;
    }

    if( ! search_track__used ) {
        search_track__used = true;
        user_tracker.log_event({
            category: 'search_used',
            action: ['page_path'],
        });
    }

    search_track__all(search_query);

    return;
} 
