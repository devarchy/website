import assert from 'assert';
import Thing from './thing';
import Resource from './resource';
import Promise from 'bluebird';
import clean_sentence from 'clean-sentence'

Promise.longStackTraces();


const child_tags__cache = {};

class Tag extends Thing {
    constructor(...args) { 
        super(
            ...args );
    } 

    get description() { 
        let desc =
            this.markdown_list__description ||
            this.definition;
        desc = clean_sentence(desc||'');
        return desc;
    } 

    get display_title() { 
        return (
            this.title ||
            markdow_list_name(this.markdown_list__github_full_name) ||
            this.name
        );

        function markdow_list_name(markdown_list__github_full_name) {
            if( ! markdown_list__github_full_name ) {
                return null;
            }
            return (
                markdown_list__github_full_name
                .split('/')[1]
                .split('-')
                .filter(str => str.length > 0)
                .map(str => str.length < 4 ? str : str.slice(0,1).toUpperCase()+str.slice(1))
                .join(' ')
            );
        }
    } 

    display_category({without_root}={}) { 
        assert(this.is_markdown_category);
        return (
            this
            .ancestor_tags
            .reverse()
            .slice(without_root?1:0)
            .concat(this)
            .map(ancestor => ancestor.display_title)
            .join(' > ')
        );
    } 

    get description__manipulated() {
        if( this.markdown_list__github_full_name === 'brillout/awesome-redux' ) {
            return 'Catalog of Redux libraries.';
        }
        return this.description;
    }
    get display_title__maniuplated(){
        if( this.markdown_list__github_full_name === 'brillout/awesome-redux' ) {
            return 'Redux Libraries';
        }
        return strip_awesome(this.display_title);

        function strip_awesome(str) {
            return str.replace(/^awesome /i,'');
        }
    }

    get child_tags() { 
        assert(this.id);
        return (
            child_tags__cache[this.id] || (
                child_tags__cache[this.id] = Thing.things.all.filter(t => (t.parent_tag||{}).id === this.id)
            )
        );
    } 

    get descendant_tags() { 
        assert(this.id);
        return (
            this.child_tags
            .map(child_tag => [child_tag].concat(child_tag.descendant_tags))
            .reduce((prev,curr) => prev.concat(curr), [])
        );
    } 

    get markdown_list_tag() { 
        assert(this.is_markdown_category || this.is_markdown_list);
        if( this.is_markdown_list ) {
            return this;
        }
        assert(this.parent_tag);
        return this.parent_tag.markdown_list_tag;
    } 

    get ancestor_tags() { 
        if( ! this.parent_tag ) {
            return [];
        }
        const parent_ancestors = this.parent_tag.ancestor_tags;
        if( parent_ancestors.some(ancestor_tag => !ancestor_tag.id || ancestor_tag.id == this.parent_tag.id) ) {
            assert(false);
            throw new Error('infinite loop catched');
        }
        return [this.parent_tag].concat(parent_ancestors);
    } 

    get depth() { 
        return this.parent_tag ?
            this.parent_tag.depth+1 : 0;
    } 

    get resource_reqs() { 
        assert( this.is_markdown_list );
        assert( this.markdown_list__data );
        return (
            Resource.list_things({tags: [this], order: {latest_requests: true}})
            .filter(resource =>
                resource
                .tagrequests
                .some(tag => tag.markdown_list_tag === this)
            )
        );
    } 

    get is_markdown_list() { 
        return (
            !! this.markdown_list__data
        );
    } 

    get is_markdown_category() { 
        const parent_tag = this.parent_tag;
        if( ! parent_tag ) {
            return false;
        }
        return parent_tag.is_markdown_list || parent_tag.is_markdown_category;
    } 

    static order() { 
        return [
            'name',
        ];
    } 

    static list_things ({only_root=false, }={}) { 
        const filter_function = !only_root ? null : tags => tags.filter(tag => !tag.parent_tag);
        return super.list_things({
            filter_function,
        });
    } 

    static get_by_name(name) { 
        assert(name);
        assert(name.constructor === String);
        return super.get_by_props({name});
    } 

    static retrieve_by_name(name) { 
        assert(name);
        return super.retrieve_by_props({name});
    } 

    static get result_fields() { 
        return super.result_fields.concat([
            'name',
            'definition',
            'markdown_list__data',
            'markdown_list__github_full_name',
            'markdown_list__description',
        ]);
    } 

    static category__get_global_id(category_id, tag_id) { 
        assert(category_id);
        assert(tag_id);
        return (
            tag_id + '_' + category_id
        );
    } 
};

Tag.type = 'tag'; // UglifyJS2 mangles class name
export default Tag;
