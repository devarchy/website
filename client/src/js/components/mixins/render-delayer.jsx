import React from 'react';
import assert_soft from 'assertion-soft';


const scheduler = (() => { 
    const defaultPriorityKey = Symbol();

    const priorityStack = (() => { 

        const priorityKeys = [];

        const priorityBuckets = {
            [defaultPriorityKey]: [],
        };

        return {
            addTask,
            removeTask,
            popHighestPriorityTask,
            isEmpty,
        };

        function isEmpty() {
            return (
                priorityKeys.length === 0 &&
                priorityBuckets[defaultPriorityKey].length === 0
            );
        }

        function popHighestPriorityTask() {
            const priorityKey = priorityKeys[0] || defaultPriorityKey;
            const bucket = priorityBuckets[priorityKey];
         // console.log(priorityKeys, priorityKeys.map(pk => priorityBuckets[pk].length));
            const task = bucket.shift();
            if( bucket.length === 0 ) {
                assert_soft((priorityKeys.length!==0)===(priorityKey!==defaultPriorityKey));
                const pk = priorityKeys.shift();
                assert_soft(pk===priorityKey || pk===undefined && priorityKey===defaultPriorityKey);
                if( pk!==undefined ) {
                    assert_soft(pk!==defaultPriorityKey);
                    delete priorityBuckets[priorityKey];
                    if( !task ) {
                        return popHighestPriorityTask();
                    }
                }
            }
            if( task ) {
                return task;
            }
            assert_soft(isEmpty());
            return null;
        }

        function addTask(task, priorityKey) {
            assert_args.apply(null, arguments);

            if( ! priorityBuckets[priorityKey] ) {
                priorityBuckets[priorityKey] = [];
                priorityKeys.push(priorityKey);
                priorityKeys.sort();
            }

            priorityBuckets[priorityKey].push(task);
        }

        function removeTask(task, priorityKey) {
            assert_args.apply(null, arguments);

            const bucket = priorityBuckets[priorityKey];
            if( !bucket ) {
                return false;
            }

            const idx = bucket.indexOf(task);
            if( idx===-1 ) {
                return false;
            }

            bucket.splice(idx, 1);

            return true;
        }

        function assert_args(task, priorityKey) {
            assert_soft(task, task, priorityKey);
            assert_soft(priorityKey, task, priorityKey);
        }
    })(); 


    let scheduler_is_running = false;

    const scheduler = {
        runTaskWhenIdle,
        cancelTask,
        batchSize: 1,
        isIdle: priorityStack.isEmpty,
        onIdle: null,
    };
    return scheduler;


    function runTaskWhenIdle(task, {priority:priorityKey=defaultPriorityKey}={}) {
        assert_soft(task && task.constructor===Function, task);

        priorityStack.addTask(task, priorityKey);

        if( !scheduler_is_running ) {
            scheduler_is_running = true;
            runNextTask();
        }
    }

    function cancelTask(task, {priority:priorityKey=defaultPriorityKey}={}) {
        return (
            priorityStack.removeTask(task, priorityKey)
        );
    }

    function runNextTask() {
        if( priorityStack.isEmpty() ) {
            scheduler_is_running = false;
            const listeners = (
                [
                    ...idleListeners,
                    ...(scheduler.onIdle ? [scheduler.onIdle] : []),
                ]
            );
            for(const listener of listeners) {
                if( ! scheduler.isIdle() ) {
                    break;
                }
                listener();
             // assert_soft(scheduler.isIdle());
            }
            return;
        }

        delayExec(() => {
            let task;
            for(var i=0;i==0 || (i<scheduler.batchSize && task);i++) {
                task=priorityStack.popHighestPriorityTask();
                task && task();
            };
            runNextTask();
        });
    }
})(); 

function delayExec(cb) { 
    const rIC__cb = () => {window.requestAnimationFrame(cb)};
    if( window.requestIdleCallback ) {
        window.requestIdleCallback(rIC__cb, {timeout: 300});
    } else {
        setTiemout(rIC__cb, 150);
    }
} 

const isBrowserEnv = ( 
    typeof window !== 'undefined' &&
    !!(window.document||{}).createElement
); 

class RenderDelayer extends React.Component { 
    constructor(props) {
        super(props);

        if( isBrowserEnv ) {
            this.hasNeverRendered = true;
        }
    }
    shouldComponentUpdate(nextProps) {
        if( nextProps.dontDelayRender ) {
            return true;
        }
        return false;
    }
    componentWillUnmount() {
        if( this.updateTask ) {
            const didCancel = scheduler.cancelTask(
                this.updateTask,
                this.updatePrio && {priority: this.updatePrio}
            );
            assert_soft(didCancel, this.updateTask, this.updatePrio);
        }
    }
    componentWillReceiveProps(nextProps) {
        if( nextProps.dontDelayRender ) {
            return;
        }
        if( this.updateTask ) {
            return;
        }
        this.delayedRender({props: this.props, nextProps});
    }
    delayedRender({props, nextProps}) {
        assert_soft(!nextProps.dontDelayRender);
        this.updateTask = () => {
            this.updateTask = null;
            this.updatePrio = null;
            this.forceUpdate();
        };
        const prio = nextProps.priority;
        this.updatePrio = (
            [null, undefined].includes(prio) ? undefined : (
                prio.constructor === Function ? (
                    prio({props, nextProps})
                ) : (
                    prio
                )
            )
        );
        assert_soft(!prio || ![null, undefined].includes(this.updatePrio), prio, this.updatePrio);
        scheduler.runTaskWhenIdle(this.updateTask, this.updatePrio && {priority: this.updatePrio});
     // scheduler.runTaskWhenIdle(this.updateTask, {priority: 0});
    }
    render() {
        if( isBrowserEnv ) {
            if( this.hasNeverRendered ) {
                this.hasNeverRendered = false;
                if( ! this.props.dontDelayRender ) {
                    this.delayedRender({props: {}, nextProps: this.props});
                    return <noscript/>;
                }
            }
        }
        if( this.props.children.length>1 ) {
            return <div children={this.props.children} />;
        }
        /*
        if( this.props.children.length === 1 ) {
            return this.props.children[0];
        }
        */
        return this.props.children;
    }
} 
RenderDelayer.callWhenIdle = callWhenIdle;

const idleListeners = [];
function callWhenIdle(cb) { 
    if( scheduler.isIdle() ) {
        cb();
    } else {
        const listener = () => {
            const idx = idleListeners.indexOf(listener);
            assert_soft(idx>=0);
            idleListeners.splice(idx, 1);
            cb();
        };
        idleListeners.push(listener);
    }
} 


export {RenderDelayer, scheduler};
export default RenderDelayer;


