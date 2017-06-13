import assert from 'assertion-soft';

export default {
    carry_out: function(){
        assert(this.action);
        this.action();
    },
    action: null,
};
