const timerlog = require('timerlog');
const memoize = require('../../../../util/memoize');
const assert = require('assert');


module.exports = ({all_plugs}) => {

    all_plugs.plugs_thing_collection.push(plug_serializer);

    return;

    function plug_serializer({resume_process}) {
        return (
            resume_process()
            .then(output => {
                const things_matched = output.things_matched;
                assert(things_matched);

                const things_matched__hash = (output.plugin_memory_cache||{}).things_matched__hash;
                assert(output.plugin_memory_cache === undefined || things_matched__hash);

                const plugins_info = {};
                for(var key in output) {
                    if( key.startsWith('plugin_') ) {
                        plugins_info[key] = output[key];
                    }
                }

                output.serialize_me = (
                    args_serialize =>
                        serialize(Object.assign({things_matched, things_matched__hash, plugins_info}, args_serialize))
                );

                return output;
            })
        );
    }

};

function serialize({things_matched, things_matched__hash, plugins_info, include_side_props, include_plugins_info}) { 

    const cache_key = (
        {
            things_matched__hash,
            plugins_info,
            include_side_props,
            include_plugins_info,
        }
    );

    if( ! things_matched__hash ) {
        return computation();
    }

    return (
        memoize({
            memory_cluster: 'serialize_plugin',
            cache_key,
            computation,
        }).content
    );

    function computation() {
        timerlog({ 
            id: 'slow_serialize_things',
            tag: 'slowiness_tracker',
            measured_time_threshold: 1000,
            start_timer: true,
        }); 
        timerlog({ 
            id: 'serialize_things',
            tags: ['performance', 'db_processing'],
            start_timer: true,
        }); 

        const obj = {};

        obj.things_matched = things_matched;

        if( include_plugins_info ) {
            Object.assign(obj, plugins_info)
        }

        const obj_str = JSON.stringify(obj);

        timerlog({ 
            id: 'serialize_things',
            end_timer: true,
        }); 
        timerlog({ 
            id: 'slow_serialize_things',
            end_timer: true,
        }); 

        return obj_str;
    }

} 
