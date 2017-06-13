const assert = require('assert');

module.exports = deep_equal;

/*
const assert = require('assert');

function deep_equal(a, b, keys_to_ignore=[]) {
    assert([a, b].every(v => [null, undefined].includes(v) || [Object, Array, Number, String, Boolean].includes(v.constructor)), a);
    if( [a, b].every(o => (o||0).constructor === Object) ) {
        if( ! same_content(Object.keys(a), Object.keys(b), keys_to_ignore) )
            return false;
        for(let i in b) if( ! keys_to_ignore.includes(i) && ! deep_equal(a[i], b[i]) ) return false;
        return true;
    }
    return a === b;

    function same_content(arr1, arr2, elements_to_ignore) {
        return (
            arr1.every(e => elements_to_ignore.includes(e) || arr2.includes(e)) &&
            arr2.every(e => elements_to_ignore.includes(e) || arr1.includes(e))
        );
    }
}
*/

function deep_equal(a, b, keys_to_ignore=[]) { 
    assert([a, b].every(v => is_primitive(v) || is_iterable(v)), a);

    if( [a, b].every(o => is_iterable(o)) ) {
        return (
            []
            .concat(Object.keys(a), Object.keys(b))
            .filter(key => !keys_to_ignore.includes(key))
            .every(key => deep_equal(a[key], b[key]))
        );
    }

    if( [a, b].some(v => v&&v.constructor===Date) ) {
        const a_epoch = new Date(a).getTime();
        const b_epoch = new Date(b).getTime();
        if( isNaN(a_epoch) || isNaN(b_epoch) ) {
            return false;
        }
        return a_epoch === b_epoch;
    }

    return a === b;


    function is_primitive(v) {
        return [null, undefined].includes(v) || [Date, Number, String, Boolean].includes(v.constructor);
    }

    function is_iterable(v) {
        return v instanceof Object;
    }
} 

