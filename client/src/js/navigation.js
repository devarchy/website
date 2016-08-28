import assert from 'assert';
import timerlog from 'timerlog';
import { createHistory, createHashHistory } from 'history';

// Using history@2 and not history@3 because of listeners being called twice

assert(
    typeof window !== 'undefined',
    'this module handles URL changes, it is therefore meant to be run in the browser');


const history = window.location.host==='localhost:8082' && createHashHistory() || createHistory();

const navigation = {
    navigate: pathname => history.push({pathname}),
 // history@3 doesn't initial call listeners
 // current: history.getCurrentLocation().pathname,
    current: null,
    on_change: null,
    user_has_not_navigated_yet: true,
};

history.listen(({pathname}) => {
    timerlog({tag:'dataflow', message: 'User navigated to '+pathname});
    assert(pathname.constructor === String)
    if( navigation.current !== null ) { // not needed for history@3
        navigation.user_has_not_navigated_yet = false;
    }
    navigation.current = pathname;
    if( navigation.on_change ) navigation.on_change();
})

export default navigation;
