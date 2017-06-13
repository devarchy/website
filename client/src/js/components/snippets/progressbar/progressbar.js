import NProgress from 'nprogress';


NProgress.configure({
    minimum: 0.1,
    showSpinner: false,
    speed: 700,
    trickleSpeed: 100,
});

const start = () => {
    NProgress.start();
};
const done = () => {
    NProgress.done();
};
/*
let queued = false;
let is_done = true;

const start = () => {
    if( !is_done ) {
        queued = true;
        return;
    }
    NProgress.start();
    is_done = false;
};
const done = () => {
    NProgress.done();
    setTimeout(() => {
        is_done = true;
        if( queued ) {
            queued = false;
            start();
        }
    }, 1000);
};
*/


export default {
    start,
    done,
};
