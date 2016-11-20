const assert = require('assert');


module.exports = turn_into_error_object;
turn_into_error_object.is_error_object = is_error_object;


const error_props = ['stack', 'message', 'name',];

function turn_into_error_object(obj, err_obj=new Error()) {
    assert(is_error_object(err_obj), err_obj);
    error_props.forEach(prop => {
        Object.defineProperty(obj, prop, {enumerable: false, writable: true, configurable: true, value: err_obj[prop]});
    });
    assert(is_error_object(obj), obj);
    return obj;
}

function is_error_object(obj) {
    return (
        typeof obj === "object" &&
        error_props.every(prop => typeof obj[prop] === "string")
    );
};
