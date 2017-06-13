module.exports = {
    get_val,
    set_val,
    as_array,
};

function get_val(obj, path) {
    let val = obj;
    as_array(path).forEach(key => val = (val||{})[key]);
    return val;
}

function set_val(obj, val, path) {
    let obj_child = obj;
    const dirs = as_array(path).slice(0, -1);
    const key = as_array(path).slice(-1);
    dirs.forEach(dir => {
        if( obj_child[dir]!==undefined && !( obj_child[dir] instanceof Object ) ) {
            throw new Error('obj_path: '+dir+' is already set to a non-object-instance: '+obj_child[dir]);
        }
        obj_child[dir] = obj_child[dir] || {};
        obj_child = obj_child[dir];
    })
    obj_child[key] = val;
}

function as_array(path) {
    return path.split('.');
}
