import assert from 'assert';

export default {
    carry_out: function(){
        assert(this.action);
        this.action();
    },
    action: null,
};
