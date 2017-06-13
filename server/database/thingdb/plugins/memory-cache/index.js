const assert = require('assert');
const assert_soft = require('assertion-soft');
const Promise = require('bluebird'); Promise.longStackTraces();
const nodejs_hash = require('../../../../util/nodejs_hash');
const memoize = require('../../../../util/memoize');
const timerlog = require('timerlog');


const memory_cluster = 'database_cache';

module.exports = ({all_plugs}) => {

    all_plugs.plugs_save_thing.push(plug_saving);

    all_plugs.plugs_load_things.push(plug_loading_things);

    return;


    function plug_saving({args, resume_process}) {
     // const [{tings_props_initial, things_matched, draft_props, }] = args;
        memoize.empty_cache({memory_cluster});
        return Promise.resolve();
     // return resume_process();
    }

    function plug_loading_things({args, resume_process}) {
        const [things_props, opts={}] = args;

        assert(things_props.constructor === Object);
        assert(Object.keys(things_props).length > 0);

        const {result_fields} = opts;

        {
            const number_of_args = args.length;
            assert_soft(number_of_args<=2, JSON.stringify(args, null, 2));
            if( number_of_args > 2 ) {
                return resume_process();
            }
        }
        {
            const has_result_influencing_option = (
                Object.keys(opts)
                .some(key => {
                    if( [].includes(key) ) {
                        return true;
                    }

                    if( ['transaction', 'result_fields'].includes(key) ) {
                        return false;
                    }

                    assert_soft(false, key);
                    return true;
                })
            );

            if( has_result_influencing_option ) {
                return resume_process();
            }
        }

        return (
            Promise.resolve()
            .then(() =>
                memoize.promise({
                    memory_cluster,
                    cache_key: {things_props, result_fields},
                    message_addendum: ' for '+JSON.stringify(things_props),
                    computation: () => (
                        resume_process()
                        .then(result => {
                            assert(result.constructor===Object);
                            assert(result.things_matched.constructor===Array);
                            timerlog({ 
                                id: 'hash_things_matched',
                                tags: ['performance', 'db_processing'],
                                start_timer: true,
                            }); 
                            const things_matched__hash = nodejs_hash(result.things_matched);
                            assert(things_matched__hash);
                            timerlog({ 
                                id: 'hash_things_matched',
                                end_timer: true,
                            }); 
                            result.plugin_memory_cache = {things_matched__hash};
                            return result;
                        })
                    ),
                })
            )
            .then(memoize_resp => {
                assert([true, false].includes(memoize_resp.is_from_cache));
                assert(memoize_resp.content.constructor===Object);
                const result = Object.assign({}, memoize_resp.content);
                result.plugin_memory_cache = Object.assign({is_from_cache: memoize_resp.is_from_cache}, result.plugin_memory_cache);
                assert(result.things_matched.constructor===Array);
                assert(result.plugin_memory_cache.things_matched__hash);
                return result;
            })
        );
    }

};
