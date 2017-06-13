const assert = require('assert');
const Promise = require('bluebird'); Promise.longStackTraces();
const timerlog = require('timerlog');
const nodejs_hash = require('../util/nodejs_hash');
const sizeof = require('object-sizeof');


const DISABLE_CACHE = false;
const ALWAYS_CACHE_MISS = false;
const DEBUG_SIZE = true;

module.exports = memoize;

function memoize({memory_cluster, cache_key, computation, message_addendum=''}) {
    assert(memory_cluster);
    assert(cache_key);
    assert(computation);

    if( DISABLE_CACHE ) {
        return ({
            is_from_cache: false,
            content: computation(),
        });
    }

    const key = hash_key({cache_key});

    let is_hit = memory.has({memory_cluster, key});

    if( ALWAYS_CACHE_MISS ) {
        is_hit = false;
    }

    timerlog({tags: ['cache', memory_cluster], message: 'cache '+(is_hit?'hit':'miss')+message_addendum});

    if( ! is_hit ) {
        const value = computation();
        memory.set({memory_cluster, key, value});
    }

    const content = memory.get({memory_cluster, key});

    return ({
        is_from_cache: is_hit,
        content,
    });
};

memoize.promise = function({memory_cluster, cache_key, computation, message_addendum=''}) {
    assert(memory_cluster);
    assert(cache_key);
    assert(computation);

    if( DISABLE_CACHE ) {
        return (
            computation()
            .then(content => ({
                is_from_cache: false,
                content,
            }))
        );
    }

    const key = hash_key({cache_key});

    let is_hit = memory.has({memory_cluster, key});

    if( ALWAYS_CACHE_MISS ) {
        is_hit = false;
    }

    timerlog({tags: ['cache', memory_cluster], message: 'cache '+(is_hit?'hit':'miss')+message_addendum});

    return (
        Promise.resolve()
        .then(() => {
            if( is_hit ) {
                return;
            }
            return (
                computation()
                .then(value => {
                    memory.set({memory_cluster, key, value});
                })
            );
        })
        .then(() => ({
            content: memory.get({memory_cluster, key}),
            is_from_cache: is_hit,
        }))
    );

};

memoize.empty_cache = function({memory_cluster}) {
    memory.clear({memory_cluster});
};

memoize.LOG_MEMORY_SIZE = false;

const memory = (() => {
    class MemoizeMemory {};
    const memory_object = new MemoizeMemory();
    return {
        set: ({memory_cluster, key, value}) => {
            assert(key);
            assert(value!==undefined);
            get_cluster_memory({memory_cluster})[key] = value;
            print_memory_size();
        },
        get: ({memory_cluster, key}) => {
            assert(key);
            const cluster_memory = get_cluster_memory({memory_cluster});
            assert(key in cluster_memory);
            const value = get_cluster_memory({memory_cluster})[key];
            assert(value!==undefined);
            return value;
        },
        has: ({memory_cluster, key}) => {
            assert(key);
            const cluster_memory = get_cluster_memory({memory_cluster});
            return (key in cluster_memory);
        },
        clear: ({memory_cluster}) => {
            const cluster_memory = get_cluster_memory({memory_cluster});
            for(var i in cluster_memory) delete cluster_memory[i];
        },
        sizeof: () => {
            const start = new Date();
            var sizes = {};
            for(var memory_cluster in memory_object) {
                sizes[memory_cluster] = sizeof(memory_object[memory_cluster])/(1000*1000)+" MB";
            }
            sizes.time_to_compute = (new Date() - start)+'ms';
            return sizes;
        },
    };

    function get_cluster_memory({memory_cluster}) {
        return memory_object[memory_cluster] = memory_object[memory_cluster] || {};
    }
})();


let last_memory_print;
let timeout;
function print_memory_size() {
    if( ! memoize.LOG_MEMORY_SIZE ) {
        return;
    }
    if( timeout ) {
        return;
    }

    timeout = setTimeout(() => {
        timeout = null;

        if( last_memory_print ) {
            const interval_minutes = (
                (memoize.LOG_MEMORY_SIZE||{}).constructor===Number ? (
                    memoize.LOG_MEMORY_SIZE
                ) : (
                    10
                )
            );

            const minutes_since_last_print = ( new Date() - last_memory_print ) / (60*1000);

            if( interval_minutes > minutes_since_last_print ) {
                return;
            }
        }

        print();

    }, 120*1000);

    return;

    function print() {
        console.info("Cache sizes: "+JSON.stringify(memory.sizeof(), null, 2));
        last_memory_print = new Date();
    }
}

function hash_key({cache_key}) {
    assert([String, Object, Array].includes(cache_key.constructor), cache_key);
    let key = cache_key.constructor===String ? cache_key : JSON.stringify(cache_key);
    key = nodejs_hash(key);
    return key;
}
