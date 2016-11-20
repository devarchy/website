const assert = require('assert');


module.exports = prune_dissmissed_processors;


function prune_dissmissed_processors(categories) {
    return (
        categories
        .map(category_ => {
            if( category_.resources.length===0 ) {
                return category_;
            }
            const category = Object.assign({},category_);
            const is_npm_list = (() => {
                let ret = true;
                category.resources.forEach(info => ret = ret && !!info.as_npm_catalog);
                return ret;
            })();
            category.resources =
                category.resources
                .map(info => {
                    if( is_npm_list ) {
                        assert(info.as_npm_catalog);
                        return {as_npm_catalog: info.as_npm_catalog};
                    }
                    assert(info.as_web_catalog);
                    return {as_web_catalog: info.as_web_catalog};
                });
            if( is_npm_list ) {
                category.is_npm_section = true;
            } else {
                category.is_web_section = true;
            }
            return category;
        })
    );
}
