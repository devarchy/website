import assert from 'assertion-soft';
import timerlog from 'timerlog';
import { createHistory, createHashHistory } from 'history';

// Using history@2 and not history@3 because of listeners being called twice

assert(
    typeof window !== 'undefined',
    'this module handles URL changes, it is therefore meant to be run in the browser');


const history = window.location.host==='localhost:8082' && createHashHistory() || createHistory();

const navigation = {
    update_location: pathname => history.replace({pathname}),
    navigate_to: pathname => history.push({pathname}),
 // history@3 doesn't initial call listeners
 // current: history.getCurrentLocation().pathname,
    current: null,
    on_change: null,
    user_has_not_navigated_yet: true,
    commit_path_to_browser_history,
};

let not_commited_to_browser_history = false

history.listen(({pathname, action}) => {
    assert(pathname.constructor === String)

    not_commited_to_browser_history = action==='REPLACE';

    if( action==='REPLACE' ) {
        navigation.current = pathname;
        return;
    }

    if( navigation.current === pathname ) {
        return;
    }

    if( navigation.current !== null ) { // not needed for history@3
        navigation.user_has_not_navigated_yet = false;
    }

    timerlog({tag:'dataflow', message: 'User navigated to '+pathname});

    navigation.current = pathname;

    if( navigation.on_change ) navigation.on_change();
});

function commit_path_to_browser_history() {
    if( ! not_commited_to_browser_history ) {
        return false;
    }
    navigation.navigate_to(navigation.current);
    return true;
}

export default navigation;
